export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.myId = null;
        this.isHost = false;

        // Callbacks
        this.onConnect = null;
        this.onData = null;
        this.onError = null;
    }

    init(onOpen) {
        // Create Peer with random ID
        // Note: In real prod, use own TURN server. Here we use public PeerJS server.
        // We need to load PeerJS library in HTML first
        if (!window.Peer) {
            console.error("PeerJS not loaded");
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
        // Connect to Host
        const conn = this.peer.connect(peerId);
        this.handleConnection(conn);
    }

    handleConnection(conn) {
        this.conn = conn;

        this.conn.on('open', () => {
            console.log("Connected to: " + this.conn.peer);
            if (this.onConnect) this.onConnect();
        });

        this.conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });

        this.conn.on('close', () => {
            alert("Connection closed");
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
