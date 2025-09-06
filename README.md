# Sistema de Reservas de Estacionamiento

Un sistema completo para gestionar reservas de espacios de estacionamiento con interfaz web moderna y API REST.

## Arquitectura

### Backend
- **Framework**: Node.js con Express
- **Base de datos**: JSON file (db.json)
- **Puerto**: 3001
- **Características**:
  - API RESTful para gestión de reservas
  - Validación de datos y manejo de errores
  - Control de concurrencia para evitar race conditions
  - Logs detallados para debugging

### Frontend
- **Tecnologías**: HTML5, CSS3, JavaScript (ES6+)
- **Características**:
  - Interfaz responsive y moderna
  - Accesibilidad mejorada (ARIA, navegación por teclado)
  - Validación de formularios en tiempo real
  - Estados de carga y feedback visual
  - Notificaciones toast para mensajes de usuario

## Instalación y Configuración

### Prerrequisitos
- Node.js (versión 14 o superior)
- npm

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
# El frontend no requiere instalación adicional, solo abrir index.html en un navegador
```

## Ejecución

Para probar la aplicación, necesitarás **dos terminales separadas**. Los comandos `npm start` y `npx serve` deben ejecutarse desde sus respectivas carpetas (`backend` y `frontend`), no desde la carpeta raíz del proyecto.

**Terminal 1: Iniciar el Backend (el servidor)**
```bash
# 1. Navega a la carpeta del backend
cd backend
# 2. Inicia el servidor
npm start
```
El servidor estará disponible en `http://localhost:3001`

### Iniciar el Frontend
La forma más confiable de ejecutar el frontend es usando un servidor web local simple para evitar problemas de CORS del navegador.
```bash
cd frontend
# El siguiente comando usará npx para descargar y ejecutar temporalmente el paquete 'serve'
npx serve
```

## Uso

1. Abrir la aplicación en el navegador
2. Completar el formulario de reserva:
   - Seleccionar fecha (solo fechas futuras)
   - Ingresar hora de inicio y fin
   - Escribir nombre completo
3. Hacer clic en "Buscar Espacios Disponibles"
4. Seleccionar un espacio disponible
5. Confirmar la reserva
6. Ver las reservas existentes en la sección "Mis Reservas"

## API Endpoints

### GET /api/reservations
Obtiene todas las reservas existentes.

### GET /api/parking-spots
Consulta disponibilidad de espacios para una fecha y horario específicos.

**Parámetros requeridos:**
- `date`: Fecha en formato YYYY-MM-DD
- `startTime`: Hora de inicio en formato HH:MM
- `endTime`: Hora de fin en formato HH:MM

### POST /api/reservations
Crea una nueva reserva.

**Cuerpo requerido:**
```json
{
  "spotId": 1,
  "date": "2024-12-25",
  "startTime": "09:00",
  "endTime": "17:00",
  "user": "Juan Pérez"
}
```

### DELETE /api/reservations/:id
Cancela una reserva existente.

## Validaciones

- **Fecha**: Solo fechas futuras permitidas
- **Horario**: Hora de fin debe ser posterior a hora de inicio
- **Nombre**: Solo letras y espacios, entre 2 y 50 caracteres
- **Espacio**: ID entre 1 y 14
- **Disponibilidad**: No se permiten reservas que se solapen

## Características de Accesibilidad

- Soporte completo para navegación por teclado
- Atributos ARIA para lectores de pantalla
- Indicadores visuales claros para estados
- Mensajes de ayuda descriptivos
- Contraste adecuado de colores

## Pruebas

### Backend
```bash
cd backend
npm test
```

### Cobertura de Pruebas
- Validación de endpoints
- Manejo de errores
- Casos límite y edge cases
- Validaciones de negocio

## Mejoras Implementadas

### Backend
- ✅ Control de concurrencia para evitar race conditions
- ✅ Validación de fechas pasadas
- ✅ Logs detallados para debugging
- ✅ Manejo robusto de errores
- ✅ Pruebas unitarias

### Frontend
- ✅ Atributos ARIA y roles para accesibilidad
- ✅ Validación mejorada de formularios
- ✅ Estados de carga visuales
- ✅ Feedback mejorado para interacciones
- ✅ Navegación por teclado completa

### General
- ✅ Documentación completa de API
- ✅ Configuración de entorno de desarrollo
- ✅ Estructura de proyecto organizada

## Próximas Mejoras

### Backend
- Autenticación y autorización de usuarios
- Migración a base de datos relacional
- Rate limiting para protección
- Caché para mejor rendimiento

### Frontend
- PWA (Progressive Web App)
- Tema oscuro/claro
- Notificaciones push
- Internacionalización (i18n)

## Estructura del Proyecto
```
/
├── backend/
│   ├── index.js          # Servidor principal
│   ├── db.json           # Base de datos local
│   ├── package.json      # Dependencias backend
│   ├── tests/            # Pruebas
│   └── README.md         # Documentación API
├── frontend/
│   ├── index.html        # Página principal
│   ├── styles.css        # Estilos CSS
│   ├── script.js         # Lógica principal
│   ├── api.js           # Cliente API
│   ├── ui.js            # Componentes UI
│   └── toast.js         # Notificaciones
└── README.md            # Este archivo
```

## Contribución

1. Fork el proyecto
2. Crear una rama para la nueva funcionalidad
3. Commit de los cambios
4. Push a la rama
5. Crear un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT.
