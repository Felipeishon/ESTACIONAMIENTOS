# Tareas Pendientes y Futuras Mejoras (Backend)

Este archivo contiene una lista de posibles mejoras para el backend que van más allá de la implementación inicial.

- **Usar una base de datos real**: Reemplazar `db.json` con una base de datos como SQLite (para simplicidad) o PostgreSQL/MongoDB para un entorno de producción. Esto resolverá problemas de concurrencia (race conditions) y mejorará el rendimiento.

- **Separar Lógica de Negocio**: Extraer la lógica de las rutas (controllers) a módulos de servicio y la lógica de acceso a datos a un módulo de repositorio/modelo. Esto mejora la organización y facilita las pruebas.

- **Variables de Entorno**: Mover configuraciones como `PORT` y `NUMBER_OF_SPOTS` a un archivo `.env` para que la aplicación sea más configurable entre diferentes entornos (desarrollo, producción).

- **(Hecho)** **Pruebas Unitarias e Integración**: Añadir un framework de pruebas como Jest o Mocha para asegurar que los endpoints y la lógica de negocio funcionen como se espera y prevenir regresiones.

- **Autenticación y Autorización**: Implementar un sistema para que solo usuarios autenticados puedan hacer reservas y solo puedan modificar/eliminar sus propias reservas.