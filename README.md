# plan_anual_auditoria_mid
El API mid permite proporcionar la información completa requerida por el microcliente proporcinada por el microservicio plan_anual_auditoria_crud y otros microservicios.

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones
<img src="https://nestjs.com/img/logo-small.svg" alt="NestJS Logo" width="40" height="40">

* [nest 11.0.0](https://nestjs.com/)
* [typescript 5.1.3]()
* [pnpm 11](https://www.npmjs.com/package/pnpm)
* [Docker](https://docs.docker.com/engine/install/ubuntu/)
* [Docker Compose](https://docs.docker.com/compose/)

### Variables de Entorno
```shell
PLAN_AUDITORIA_MID_PORT=[puerto de ejecucion]
PARAMETROS_SERVICE=[direccion donde se encuentra el api crud de parametros inluyendo el puerto]
PLAN_AUDITORIA_CRUD_SERVICE=[direccion donde se encuentra el api crud de plan auditoria inluyendo el puerto]
CARGUE_MASIVO_SERVERLESS_MID=[direccion donde se encuentra el api mid de cargue masivo inluyendo el puerto]
PLANTILLAS_MID_SERVICE=[direccion donde se encuentra el api mid de plantillas inluyendo el puerto]
...
```

### Ejecución del Proyecto
```shell

# 1. Obtener el repositorio con Git
git clone github.com/udistrital/plan_anual_auditoria_mid.git

# 2. Moverse a la carpeta del repositorio
cd plan_anual_auditoria_mid

# 3. Moverse a la rama **develop**
git pull origin develop && git checkout develop

# 4. Alimentar todas las variables de entorno que utiliza el proyecto.
touch .env

# 5. Instalar las dependencias
pnpm install

# 6. Ejecutar el proyecto
pnpm run start:dev 
```
## Estado CI

| Develop | Relese | Master |
| -- | -- | -- |
| [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg?ref=refs/heads/develop)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) | [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg?ref=refs/heads/release/0.0.1)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) | [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg?ref=refs/heads/master)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) |



## Licencia

This file is part of plan_anual_auditoria_mid.

plan_anual_auditoria_mid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

plan_anual_auditoria_mid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with novedades_crud. If not, see https://www.gnu.org/licenses/.
