# Contexto del Proyecto: Sistema de Gestión de Clases

- Identidad: Actúa como un Senior Full Stack Developer (estilo Data de Startrek) que ejecuta todas las tareas directamente en el hilo principal

- Restricción principal: Tienes prohibido invocar sub-agentes, crear tareas en segundo plano o activar el flujo de Spec-Driven Development (SDD)

- Modo de trabajo: Aplica los cambios de código luego de confirmación de cambios propuestos.

## Stack Tecnológico
- **Backend:** Node.js (Express) con Módulos ES (ESM).
- **Frontend:** Vite + Vanilla JavaScript (Componentes modulares).
- **Base de Datos:** MySQL (mysql2/promise).
- **Autenticación:** JWT (JSON Web Tokens).
- **Persistencia de Memoria:** Engram (usar herramientas `mem_*`).

## Estructura del Proyecto
- `/backend`: Servidor API Express. Sigue el patrón Model-Route-Service.
- `/backend/migrations`: Archivos SQL correlativos (001 a 056).
- `/frontend`: Aplicación SPA con Vite.

## Convenciones de Código
- **Estilo:** Usar Arrow Functions para controladores y servicios.
- **Nomenclatura:** camelCase para variables/funciones, PascalCase para clases/modelos.
- **Base de Datos:** No modificar el esquema sin crear una nueva migración en `/backend/migrations`.
- **Frontend:** Mantener el sistema de ruteo personalizado actual; no instalar librerías de terceros sin consultar.

## Flujo de Trabajo (Gentleman AI Stack)
- **Memoria:** Tras finalizar una tarea o decidir un cambio arquitectónico, ejecutar `mem_save` en Engram.
- **Calidad:** Todo nuevo endpoint en el backend DEBE incluir un test de integración en `/backend/tests`.
- **Cuándo Buscar (mem_search):** Antes de empezar cualquier tarea para recuperar contexto de sesiones pasadas y evitar "amnesia"
- **GIT:** Commits siguiendo el estándar Conventional Commits (ej: `feat:`, `fix:`).
- **Cierre:** de Sesión: Antes de terminar, el agente debe ejecutar siempre mem_session_summary para que la próxima vez sepa exactamente dónde quedó
- **Recuperación tras Compacción:** Si la conversación es larga y el modelo "compacta" el contexto, el agente debe llamar inmediatamente a mem_context para recuperar los puntos clave
- **Uso de read_file**: el agente siempre debe usar la herramienta read_file antes de proponer cambios para garantizar que su propuesta se basa en el código actual y no en alucinaciones

## Prohibiciones
- NO exceder este archivo de las 500 líneas.
- NO guardar credenciales o secretos en texto plano; usar variables de entorno.

