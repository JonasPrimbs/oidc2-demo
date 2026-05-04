# OIDC² Demo

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.0.

## Test Deployment

1. Copy `example.env` to `.env` and adjust values.
2. Run `./scripts/generate-ca-config.sh`.
3. Run `./scripts/generate-secrets.sh`.
4. Import `./.secrets/ca_root.crt` to your browser.
5. Run `docker compose up --build`.
6. Go to https://op.example.com/ and log in with username `admin` and password `$KC_BOOTSTRAP_ADMIN_PASSWORD` from `./.secrets/op.env`.
7. Switch to realm `oidc2`, go to *Realm settings > Keys* and add `./.secrets/op_private.key` as a new RSA provider.
8. Set the `Kid` of this new `rsa` provider as `KID` in `.env`.
9. Stop the Docker composition with CTRL+C and start it again with `docker compose up -d`
