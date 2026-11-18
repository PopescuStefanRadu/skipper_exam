# Kratos with this app's configuration, filled in from the environment at start-up
# (entrypoint.sh). Used by the test stack and in production.
FROM oryd/kratos:v1.3.1
COPY --chown=ory kratos.yml.tmpl identity.schema.json oidc.google.jsonnet entrypoint.sh /etc/config/kratos/
COPY --chown=ory courier-templates /etc/config/kratos/courier-templates
ENTRYPOINT ["/etc/config/kratos/entrypoint.sh"]
CMD ["serve"]
