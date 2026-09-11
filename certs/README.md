# certs/

`rds-global-bundle.pem` — Amazon RDS root/intermediate CA bundle, downloaded
verbatim from https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
(public, not a secret). RDS server certificates chain to Amazon's private CA,
which Node does not trust by default, and `pg` >= 8.16 verifies the chain for
`sslmode=require`. The Dockerfile sets `NODE_EXTRA_CA_CERTS` to this file; for
laptop-side `db:migrate` against RDS do the same:

```bash
NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem npm run db:migrate
```

Refresh when AWS rotates the bundle (announced years ahead).
