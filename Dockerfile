FROM node:18 AS builder

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


FROM nginx:1.25-alpine AS runtime

# Update packages
RUN apk update

# Copy nginx config
COPY ./nginx.conf /etc/nginx/nginx.conf
# Copy static files
COPY --from=builder /app/dist/oidc2-demo /var/www/app
