import { Client, type ClientChannel } from 'ssh2'
import * as fs from 'fs'
import { connect, type NatsConnection, JSONCodec } from 'nats'
import {
  PPPOE_SERVERS,
  PPPOE_SERVERS_PRIVATE_KEY,
  PPPOE_FETHED_EVENT_SUBJECT,
  NATS_TOKEN,
  NATS_SERVERS,
} from './config'

interface SSHConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string | Buffer
  passphrase?: string
  readyTimeout?: number
}

interface ServerConfig extends SSHConfig {
  name: string // Unique identifier for the server
}

interface CommandResult {
  stdout: string
  stderr: string
  code: number | null
  server: string
}

class SSHClient {
  private client: Client
  private config: SSHConfig
  private isConnected: boolean = false

  constructor(config: SSHConfig, privateKey: Buffer) {
    this.client = new Client()
    this.config = {
      ...config,
      privateKey,
      readyTimeout: config.readyTimeout || 10000, // Default timeout
    }
  }

  /**
   * Establishes SSH connection
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client
        .on('ready', () => {
          this.isConnected = true
          console.log(`SSH connection established to ${this.config.host}`)
          resolve()
        })
        .on('error', (err: any) => {
          console.error(`SSH connection error to ${this.config.host}:`, err)
          reject(err)
        })
        .on('end', () => {
          this.isConnected = false
          console.log(`SSH connection to ${this.config.host} ended`)
        })
        // Fix: Use the correct event handler type for 'close'
        .on('close', () => {
          this.isConnected = false
          console.log(`SSH connection to ${this.config.host} closed`)
        })
        .connect(this.config)
    })
  }

  /**
   * Executes a command on the remote server
   */
  public async executeCommand(
    command: string,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    if (!this.isConnected) {
      throw new Error(`SSH client not connected to ${this.config.host}`)
    }

    return new Promise((resolve, reject) => {
      this.client.exec(
        command,
        (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            return reject(err)
          }

          let stdout = ''
          let stderr = ''

          stream
            .on('close', (code: number | null, signal: string | null) => {
              resolve({
                stdout,
                stderr,
                code,
              })
            })
            .on('data', (data: Buffer) => {
              stdout += data.toString()
            })
            .stderr.on('data', (data: Buffer) => {
              stderr += data.toString()
            })
            .on('error', (err: Error) => {
              reject(err)
            })
        },
      )
    })
  }

  /**
   * Closes the SSH connection
   */
  public disconnect(): void {
    if (this.isConnected) {
      this.client.end()
      this.isConnected = false
    }
  }

  /**
   * Checks if client is connected
   */
  public get connected(): boolean {
    return this.isConnected
  }

  /**
   * Returns the host of this connection
   */
  public get host(): string {
    return this.config.host
  }
}

class SSHManager {
  private connections: Map<string, SSHClient> = new Map()

  /**
   * Adds a server configuration
   */
  public addServer(server: ServerConfig, privateKey: Buffer): void {
    if (this.connections.has(server.name)) {
      throw new Error(`Server with name "${server.name}" already exists`)
    }
    this.connections.set(server.name, new SSHClient(server, privateKey))
  }

  /**
   * Adds multiple server configurations
   */
  public addServers(servers: ServerConfig[], privateKey: Buffer): void {
    servers.forEach((server) => this.addServer(server, privateKey))
  }

  /**
   * Connects to a specific server
   */
  public async connectToServer(serverName: string): Promise<void> {
    const client = this.getClient(serverName)
    await client.connect()
  }

  /**
   * Connects to all servers
   */
  public async connectToAll(): Promise<void> {
    const connectionPromises = Array.from(this.connections.entries()).map(
      async ([name, client]) => {
        try {
          await client.connect()
          return { name, success: true }
        } catch (error) {
          console.error(`Failed to connect to ${name}:`, error)
          return { name, success: false, error }
        }
      },
    )

    await Promise.all(connectionPromises)
  }

  /**
   * Executes a command on a specific server
   */
  public async executeCommandOnServer(
    serverName: string,
    command: string,
  ): Promise<CommandResult> {
    const client = this.getClient(serverName)
    const result = await client.executeCommand(command)
    return { ...result, server: serverName }
  }

  /**
   * Executes a command on all connected servers
   */
  public async executeCommandOnAll(command: string): Promise<CommandResult[]> {
    const executionPromises = Array.from(this.connections.entries())
      .filter(([_, client]) => client.connected)
      .map(async ([name, client]) => {
        try {
          const result = await client.executeCommand(command)
          return { ...result, server: name }
        } catch (error: any) {
          console.error(`Failed to execute command on ${name}:`, error)
          return {
            stdout: '',
            stderr: error.toString(),
            code: 1,
            server: name,
          }
        }
      })

    return Promise.all(executionPromises)
  }

  /**
   * Disconnects from a specific server
   */
  public disconnectFromServer(serverName: string): void {
    const client = this.getClient(serverName)
    client.disconnect()
  }

  /**
   * Disconnects from all servers
   */
  public disconnectFromAll(): void {
    this.connections.forEach((client) => {
      if (client.connected) {
        client.disconnect()
      }
    })
  }

  /**
   * Gets the client for a specific server
   */
  private getClient(serverName: string): SSHClient {
    const client = this.connections.get(serverName)
    if (!client) {
      throw new Error(`Server with name "${serverName}" not found`)
    }
    return client
  }

  /**
   * Gets all server names
   */
  public get serverNames(): string[] {
    return Array.from(this.connections.keys())
  }

  /**
   * Gets connected server names
   */
  public get connectedServerNames(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, client]) => client.connected)
      .map(([name, _]) => name)
  }
}

/**
 * Interface for PPPoE connection data
 */
interface PPPoEInterface {
  network: string
  iface: string
}

/**
 * Interface for the data structure to be published to NATS
 */
interface PPPoEInterfaceNatsMessage {
  timestamp: number
  servers: Record<string, PPPoEInterface[]>
}

/**
 * Parses RouterOS output and extracts network and interface values
 * @param output - String output from the RouterOS command
 * @returns Array of objects containing network and interface values
 */
function parseNetworkAndInterface(output: string): PPPoEInterface[] {
  const results: PPPoEInterface[] = []

  // Split by lines and skip the header (first 3 lines)
  const lines = output.trim().split('\n').slice(3)

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Extract the network and interface values
    // This regex extracts the network (second-to-last column) and interface (last column)
    const match = line
      .trim()
      .match(/\s*\d+\s+(?:D\s+)?[\d.]+\/\d+\s+([\d.]+)\s+(<pppoe-[^>]+>)/)

    if (match) {
      results.push({
        network: match[1],
        iface: match[2],
      })
    }
  }

  return results
}

/**
 * Collects and processes PPPoE interface data from all servers
 * @param sshManager - SSH Manager instance
 * @returns Promise with PPPoE interface data organized by server
 */
async function collectPPPoEInterfaceData(
  sshManager: SSHManager,
): Promise<Record<string, PPPoEInterface[]>> {
  // Execute command on all connected servers
  const results = await sshManager.executeCommandOnAll(
    '/ip address print where interface ~"<pppoe-"',
  )

  // Initialize result structure
  const byServer: Record<string, PPPoEInterface[]> = {}

  // Process results from each server
  results.forEach((result) => {
    if (result.code === 0) {
      // Parse the output
      const interfaces = parseNetworkAndInterface(result.stdout)

      // Store by server
      byServer[result.server] = interfaces
    } else {
      console.error(`Error from ${result.server}: ${result.stderr}`)
      // Add empty array for failed servers
      byServer[result.server] = []
    }
  })

  return byServer
}

/**
 * Publishes data to NATS server
 * @param natsConn - NATS connection instance
 * @param subject - NATS subject to publish to
 * @param data - Data to publish
 */
async function publishToNats<T>(
  natsConn: NatsConnection,
  subject: string,
  data: T,
): Promise<void> {
  try {
    const jsonCodec = JSONCodec<T>()
    await natsConn.publish(subject, jsonCodec.encode(data))
    console.log(`Published data to NATS subject: ${subject}`)
  } catch (error) {
    console.error(`Error publishing to NATS subject ${subject}:`, error)
    throw error
  }
}

/**
 * Connects to NATS server
 * @param serverAddress - NATS server address
 * @param serverToken - NATS server token
 * @returns Promise with NATS connection
 */
async function connectToNats(
  serverAddress: string,
  serverToken: string,
): Promise<NatsConnection> {
  try {
    console.log(`Connecting to NATS server: ${serverAddress}`)
    const nc = await connect({ servers: serverAddress, token: serverToken })
    console.log(`Connected to NATS server: ${serverAddress}`)
    return nc
  } catch (error) {
    console.error('Error connecting to NATS server:', error)
    throw error
  }
}

export async function collectAndPublishPPPoEData() {
  // Create SSH manager
  const sshManager = new SSHManager()

  let natsConn: NatsConnection | null = null

  try {
    // Connect to NATS server
    natsConn = await connectToNats(NATS_SERVERS, NATS_TOKEN)

    // Add multiple servers
    sshManager.addServers(
      JSON.parse(PPPOE_SERVERS),
      Buffer.from(PPPOE_SERVERS_PRIVATE_KEY),
    )

    // Connect to all servers
    console.log('Connecting to all servers...')
    await sshManager.connectToAll()
    console.log(`Connected to: ${sshManager.connectedServerNames.join(', ')}`)

    // Collect PPPoE interface data from all servers
    console.log('\nCollecting PPPoE interface data...')
    const serverInterfaces = await collectPPPoEInterfaceData(sshManager)

    // For debugging
    console.log(JSON.stringify(serverInterfaces, null, 2))

    // Prepare data for NATS
    const natsMessage: PPPoEInterfaceNatsMessage = {
      timestamp: Date.now(),
      servers: serverInterfaces,
    }

    // Publish data to NATS
    console.log('\nPublishing data to NATS...')
    await publishToNats(natsConn, PPPOE_FETHED_EVENT_SUBJECT, natsMessage)
    console.log('Data published successfully')
  } catch (error) {
    console.error('Error in operations:', error)
  } finally {
    // Disconnect from all SSH servers
    console.log('\nDisconnecting from all SSH servers...')
    sshManager.disconnectFromAll()
    console.log('All SSH connections closed')

    // Close NATS connection if it exists
    if (natsConn) {
      await natsConn.close()
      console.log('NATS connection closed')
    }
  }
}
