import asyncio
import os
from dotenv import load_dotenv
from openclaw_sdk import OpenClawClient, Agent, ClientConfig
from openclaw_sdk.gateway.local import LocalGateway 

# Forzamos la carga del .env desde la ruta absoluta del script
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

async def main():
    gw = LocalGateway()
    try:
        await gw.connect() # Vital para evitar Gateway not connected
        
        client = OpenClawClient(config=ClientConfig(timeout=120), gateway=gw)
        agent = Agent(client, "SocioEstrategico")

        # Carga directa para evitar errores de ruta
        path = os.getenv("NEXCARD_PATH")
        with open(f"{path}/BITACORA_ETAPA_8.md", 'r') as f: bitacora = f.read()
        with open(f"{path}/DATABASE_SETUP.sql", 'r') as f: sql = f.read()

        print("🚀 Lanzando auditoría a Groq...")
        # ESPECIFICAR EL MODELO AQUÍ ES LO QUE DETIENE EL GASTO EN GEMINI
        query = f"Analiza si el SQL soporta los costos de NTAG215:\n\n{bitacora}\n\n{sql}"
        response = await agent.execute(query, model="groq/llama-3.1-70b-versatile")
        
        print(f"\n📊 INFORME:\n{response.content}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())