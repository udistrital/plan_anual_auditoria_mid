# plan_anual_auditoria_mid
El API mid permite 

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones
* [nest 10.0.0]()
* [typescript 5.6.2]()
* [Docker](https://docs.docker.com/engine/install/ubuntu/)
* [Docker Compose](https://docs.docker.com/compose/)

### Variables de Entorno

PORT=[puerto de ejecucion]

### Ejecución del Proyecto
```shel

# 1. Obtener el repositorio con Go
go get github.com/udistrital/plan_anual_auditoria_mid.git

# 2. Moverse a la carpeta del repositorio
cd $GOPATH/src/github.com/udistrital/plan_anual_auditoria_mid

# 3. Moverse a la rama **develop**
git pull origin develop && git checkout develop

# 4. alimentar todas las variables de entorno que utiliza el proyecto.

# 5. ejecutar el proyecto
npm run start 
```
## Estado CI

| Develop | Relese 0.0.1 | Master |
| -- | -- | -- |
| [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg?ref=refs/heads/develop)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) | [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg?ref=refs/heads/release/0.0.1)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) | [![Build Status](https://hubci.portaloas.udistrital.edu.co/api/badges/udistrital/plan_anual_auditoria_mid/status.svg)](https://hubci.portaloas.udistrital.edu.co/udistrital/plan_anual_auditoria_mid/) |



## Licencia

This file is part of plan_anual_auditoria_mid.

plan_anual_auditoria_mid is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

plan_anual_auditoria_mid is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with novedades_crud. If not, see https://www.gnu.org/licenses/.