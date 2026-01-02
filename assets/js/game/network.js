export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = null; // null = unknown, true = host, false = client

        // Callbacks
        this.onConnect = null;
        this.onData = null;
        this.onError = null;
    }

    init(onOpen, onError) {
        // Create Peer with random ID
        // Note: In real prod, use own TURN server. Here we use public PeerJS server.
        // We need to load PeerJS library in HTML first
        if (!window.Peer) {
            console.error("PeerJS not loaded");
            if (onError) onError("PeerJS library failed to load");
            return;
        }

        this.peer = new Peer(null, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            this.myId = id;
            console.log('My Peer ID is: ' + id);
            if (onOpen) onOpen(id);
        });

        this.peer.on('connection', (conn) => {
            // Incoming connection (I am Host)
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error(err);
            if (this.onError) this.onError(err);
        });
    }

    connect(peerId) {
        if (!this.peer || !this.peer.id) {
            console.error("My Peer Not Ready");
            if (this.onError) this.onError("My Peer ID not ready yet. Please wait.");
            return;
        }
        // Connect to Host
        const conn = this.peer.connect(peerId, { reliable: true });
        this.isHost = false; // I am the Client/Joiner
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        this.conn = conn;

        // If isHost is still null, it means this was an incoming connection -> I am Host
        if (this.isHost === null) {
            this.isHost = true;
        }

        this.conn.on('open', () => {
            console.log("Connected to: " + this.conn.peer);
            if (this.onConnect) this.onConnect(this.isHost);
        });

        this.conn.on('error', (err) => {
            console.error("Connection Error:", err);
            if (this.onError) this.onError("Connection Error: " + err);
        });

        this.conn.on('close', () => {
            if (this.onError) this.onError("Connection Closed");
        });

        this.conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });
    }

    sendMove(move) {
        if (this.conn && this.conn.open) {
            this.conn.send({
                type: 'MOVE',
                data: move
            });
        }
    }
}
