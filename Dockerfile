# Create build image
FROM node:20 AS builder

# Update packages
RUN apt-get update && apt-get upgrade -y && npm install -g npm

# Copy source files
WORKDIR /app
COPY ./src /app/src
COPY ./angular.json .
COPY ./package.json .
COPY ./tsconfig.app.json .
COPY ./tsconfig.json .
COPY ./tsconfig.spec.json .

# Install dependencies
RUN npm install
# Build for production
RUN npm run build


# Create runtime image
FROM nginx:1.25-alpine AS runtime

# Update packages
RUN apk update
RUN apk add --no-cache bash

# Copy nginx config
COPY ./nginx.conf /etc/nginx/conf.d/nginx.conf
# Copy template for environment configuration file
COPY ./config.template.js /var/www/config.template.js
# Copy static files
COPY --from=builder /app/dist/oidc2-demo /var/www/app

# Define default environment variables
# Set default port
ENV PORT=4200
# Set default URL of end-to-end encryption backend
ENV E2EE_BACKEND=http://localhost:4040

# Expose the configured port
EXPOSE $PORT

# Substitute the environment variables in config.js and run nginx
CMD ["/bin/bash", "-c", "envsubst < /var/www/config.template.js > /var/www/app/assets/config.js && exec nginx -g 'daemon off;'"]
