import asyncio
import os
from dotenv import load_dotenv
from openclaw_sdk import OpenClawClient, Agent, ClientConfig
from openclaw_sdk.gateway.local import LocalGateway 

load_dotenv()

async def verificar_sistema():
    print("🔍 DIAGNÓSTICO DE ESTABILIZACIÓN...")
    gw = LocalGateway()
    try:
        await gw.connect()
        print("✅ PASO 1: Gateway conectado.")

        # ClientConfig es el estándar para esta versión
        client = OpenClawClient(config=ClientConfig(timeout=30), gateway=gw)
        bot = Agent(client, "SocioEstrategico")
        
        print("🚀 PASO 2: Enviando pulso (Routing automático a Groq)...")
        # Quitamos 'model' para evitar el TypeError
        response = await bot.execute("Responde solo la palabra: 'CONFIRMADO'")
        
        print(f"🤖 Respuesta: {response.content}")
        print("✨ Sistema robusto. Listo para auditar Nexcard.")

    except Exception as e:
        print(f"❌ FALLO TÉCNICO: {e}")

if __name__ == "__main__":
    asyncio.run(verificar_sistema())
