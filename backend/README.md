# API de Reservas de Estacionamiento

## Descripción
Esta API proporciona funcionalidades para gestionar reservas de espacios de estacionamiento. Permite consultar disponibilidad, crear reservas y cancelar reservas existentes.

## Base URL
```
http://localhost:3001/api
```

## Endpoints

### GET /reservations
Obtiene todas las reservas existentes.

**Respuesta exitosa (200):**
```json
[
  {
    "id": "uuid",
    "spotId": 1,
    "date": "2024-12-25",
    "startTime": "09:00",
    "endTime": "17:00",
    "email": "juan.perez@iansa.cl"
  }
]
```

### GET /parking-spots
Obtiene la disponibilidad de espacios de estacionamiento para una fecha y horario específicos.

**Parámetros de consulta requeridos:**
- `date`: Fecha en formato YYYY-MM-DD
- `startTime`: Hora de inicio en formato HH:MM
- `endTime`: Hora de fin en formato HH:MM

**Ejemplo de solicitud:**
```
GET /api/parking-spots?date=2024-12-25&startTime=09:00&endTime=17:00
```

**Respuesta exitosa (200):**
```json
[
  {
    "id": 1,
    "isReserved": false
  },
  {
    "id": 2,
    "isReserved": true
  }
]
```

**Respuestas de error:**
- `400`: Parámetros faltantes o formato inválido

### POST /reservations
Crea una nueva reserva de estacionamiento.

**Cuerpo de la solicitud:**
```json
{
  "spotId": 1,
  "date": "2024-12-25",
  "startTime": "09:00",
  "endTime": "17:00",
  "user": "Juan Pérez"
}
```

**Respuesta exitosa (201):**
```json
{
  "id": "uuid-generado",
  "spotId": 1,
  "date": "2024-12-25",
  "startTime": "09:00",
  "endTime": "17:00",
  "user": "Juan Pérez"
}
```

**Respuestas de error:**
- `400`: Campos faltantes, formato inválido, fecha pasada, o hora de fin anterior a hora de inicio
- `409`: Espacio ya reservado para ese horario
- `500`: Error interno del servidor

### DELETE /reservations/:id
Cancela una reserva existente.

**Parámetros de ruta:**
- `id`: ID único de la reserva

**Respuesta exitosa (204):** Sin contenido

**Respuestas de error:**
- `404`: Reserva no encontrada
- `500`: Error interno del servidor

## Validaciones

### Campos requeridos
Todos los campos son obligatorios para crear una reserva:
- `spotId`: Número entre 1 y 14
- `date`: Fecha futura en formato YYYY-MM-DD
- `startTime`: Hora de inicio en formato HH:MM
- `endTime`: Hora de fin en formato HH:MM (debe ser posterior a startTime)
- `user`: Nombre del usuario (solo letras y espacios, 2-50 caracteres)

### Reglas de negocio
- No se permiten reservas en fechas pasadas
- No se permiten reservas que se solapen en tiempo para el mismo espacio
- La hora de fin debe ser posterior a la hora de inicio
- Solo hay 14 espacios disponibles (IDs del 1 al 14)

## Manejo de errores
La API devuelve errores en formato JSON con el campo `message` que describe el problema específico.

## Configuración
- Puerto: 3001
- Número de espacios: 14
- Base de datos: Archivo JSON local (`db.json`)

## Inicio del servidor
```bash
npm start
```

## Pruebas
```bash
npm test
