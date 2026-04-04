import asyncio
from openclaw_sdk import OpenClawClient, Agent
from openclaw_sdk.gateway.local import LocalGateway 

async def main():
    gw = LocalGateway()
    try:
        await gw.connect()
        print("✅ Gateway conectado. Servidor local detectado.")

        client = OpenClawClient(gateway=gw)
        agent = Agent(client, "main")

        print("🚀 Enviando pulso a Groq (Llama 3.3)...")
        response = await agent.execute("Responde exactamente con estas palabras y nada más: 'SISTEMA ONLINE Y BLINDADO'")
        
        print(f"🤖 Respuesta de tu IA: {response.content}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
