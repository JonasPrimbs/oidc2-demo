#! /bin/sh

template_file=${1:-"stepca/config/ca-template.json"}
config_file="stepca/config/ca.json"

# Load configuration from .env file
export $(grep -v '^#' .env | xargs)
# Generate the CA configuration file by substituting environment variables in the template
envsubst < $template_file > $config_file
