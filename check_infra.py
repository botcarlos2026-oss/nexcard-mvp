import asyncio
import os
from dotenv import load_dotenv
from openclaw_sdk import OpenClawClient, Agent, ClientConfig
from openclaw_sdk.gateway.local import LocalGateway 

# Carga forzada del .env
load_dotenv()

async def test_infra():
    print("📋 INICIANDO DIAGNÓSTICO DE RUTA ÚNICA (GROQ)...")
    gw = LocalGateway()
    try:
        # 1. Verificar Gateway
        await gw.connect()
        print("✅ Gateway: CONECTADO")

        # 2. Verificar carga de API Key
        key = os.getenv("GROQ_API_KEY")
        if not key:
            print("❌ ERROR: No se detectó GROQ_API_KEY en el entorno.")
            return
        print(f"🔑 Llave Groq detectada: {key[:6]}...{key[-4:]}")

        # 3. Configurar Cliente y Agente
        client = OpenClawClient(config=ClientConfig(timeout=60), gateway=gw)
        agent = Agent(client, "SocioEstrategico")

        # 4. Enviar Pulso (Sin argumentos extras para evitar TypeErrors)
        print("🚀 Enviando pulso de prueba a Groq...")
        query = "Responde solo con la palabra: 'ONLINE'"
        response = await agent.execute(query)
        
        print(f"🤖 Respuesta del Bot: {response.content}")
        print("✨ ¡CONEXIÓN ESTABLECIDA!")

    except Exception as e:
        print(f"❌ FALLO TÉCNICO: {e}")

if __name__ == "__main__":
    asyncio.run(test_infra())
