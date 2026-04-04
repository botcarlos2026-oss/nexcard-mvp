import openclaw_sdk
import inspect
import traceback

print("🔍 --- REPORTE DE INGENIERÍA FORENSE ---")
try:
    # 1. Ver la firma exacta de la función (Nombres de argumentos y orden)
    sig = inspect.signature(openclaw_sdk.Agent.__init__)
    print(f"\n🧬 Estructura del Constructor: Agent{sig}")
    
    # 2. Ver la ayuda interna del SDK
    print("\n📚 Documentación interna (Docstring):")
    print(openclaw_sdk.Agent.__doc__)

except Exception:
    traceback.print_exc()
