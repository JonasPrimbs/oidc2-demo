# OIDC² Demo

This project is a web application based on Angular 16 to demonstrate the capabilities of Open Identity Certification with OpenID Connect (OIDC²).

## 1. Deployment

We provide a [Dockerfile](./Dockerfile) and a [Docker Composition](./docker-compose.yaml) for containerized deployment using [Docker](https://www.docker.com/).

### 1.1. Configuration

The Docker container allows configuration with the following environment variables.

The Docker Composition wraps these environment variables in the [`.env` file](./.env).

#### 1.1.1. Port

`PORT` defines the port on which the static files will be hosted on.

- Default: `4200`
- Example: `PORT=4200`
- Composition parameter: `OIDC2_DEMO_INTERNAL_PORT` for the container's internal port; `OIDC2_DEMO_EXTERNAL_PORT` for the port on the host.

#### 1.1.2. End-to-End Encryption Backend

`E2EE_BACKEND` defines the base URL of the End-to-End Encryption Backend.
This URL must be reachable from the browser (= client) which runs the OIDC² Demo app.

- Default: `http://localhost:4040`
- Example: `E2EE_BACKEND=http://localhost:4040`
- Composition parameter: `E2EE_BACKEND_URL`

### 1.2. Run Production Server

After [installing Docker](https://docs.docker.com/engine/install/ubuntu/), run the Docker Composition:

```bash
# Run the entire docker composition
docker compose up
```

## 2. Development

### 2.1. Environment Setup

Install Node.js and dependencies on Ubuntu 20.04. Also works on [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install).

1. Install Node.js 20 (version 18 is also fine):
```bash
# Download setup script
curl -sL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
# Run setup script
sudo bash /tmp/nodesource_setup.sh
# Install node.js via apt
sudo apt install nodejs
# Update node package manager (NPM)
sudo npm install -g npm
```
2. Clone repository and install packages
```bash
# Clone repository
git clone https://github.com/JonasPrimbs/oidc2-demo.git
# Move to cloned repository
cd oidc2-demo
# Install packages
npm install
```

### 2.2. Run Development Server

Run the development server on [http://localhost:4200](http://localhost:4200).

1. Run `npm run start` for a dev server.
2. Navigate to `http://localhost:4200/`.

The application will automatically reload if you change any of the source files.

### 2.3. Build for Production

Run `npm run ng build` to build the project.
The build artifacts will be stored in the `dist/` directory.
