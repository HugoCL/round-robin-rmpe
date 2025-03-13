export const runtime = 'edge';
// Store active connections
const clients = new Set<{
    id: string
    controller: ReadableStreamController<Uint8Array>
}>()

// Function to send updates to all connected clients
export function notifyClients(data: any) {
    const message = `data: ${JSON.stringify(data)}\n\n`

    clients.forEach((client) => {
        try {
            client.controller.enqueue(new TextEncoder().encode(message))
        } catch (error) {
            console.error("Error sending message to client:", error)
            // Remove failed client
            clients.delete(client)
        }
    })
}

export async function GET() {
    const clientId = crypto.randomUUID()

    // Create a new stream
    const stream = new ReadableStream({
        start(controller) {
            clients.add({ id: clientId, controller })

            // Send initial connection message
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`))
        },
        cancel() {
            // Remove client when connection is closed
            clients.delete([...clients].find((client) => client.id === clientId)!)
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}

