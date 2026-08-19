# Deployment Research Notes

## Official hosting findings

| Provider | Finding relevant to StudyMatrix | Source |
| --- | --- | --- |
| Render | Free web services and free Postgres are available for testing and hobby use. Render explicitly advises against using free instances for production; free Postgres can restart and does not provide backups. | https://render.com/docs/free |
| Render Node.js | A Node/Express web service is deployed by connecting a repository and supplying the project-specific build and start commands. | https://render.com/docs/deploy-node-express-app |
| Railway | The pricing page presents a 30-day trial with $5 credits, followed by a $1 monthly charge. Treat it as a low-cost trial/hobby route rather than an indefinitely free production guarantee. | https://railway.com/pricing |
| TiDB Cloud Starter | The free quota covers up to five Starter instances per organization. Each eligible instance receives 5 GiB row storage, 5 GiB columnar storage, and 50 million request units per month. TiDB is MySQL-compatible, matching the current project adapter. | https://www.pingcap.com/tidb-cloud-starter-pricing-details/ |
| Expo EAS | EAS offers a limited number of low-priority free builds and free updates; limits reset monthly. A custom Android build is required for the Bluetooth Classic native module. | https://docs.expo.dev/billing/plans/ |

## Implementation and document findings

| Item | Confirmed implementation detail | Source |
| --- | --- | --- |
| Node deployment commands | Render’s Node/Express guidance requires project-specific build and start commands. This project provides `pnpm build` and `pnpm start`. | https://render.com/docs/deploy-node-express-app |
| Android test build | Expo documents limited monthly low-priority free EAS builds and free updates. The native Bluetooth module requires a custom build, not Expo Go. | https://docs.expo.dev/billing/plans/ |
| Glossary package | The frozen Typst plan selected `@preview/glossarium:0.5.10`; its documented API imports `make-glossary`, `register-glossary`, `print-glossary`, `gls`, and `glspl`. | https://typst.app/universe/package/glossarium/ |

## Reporting stance

The report must distinguish **testing/free-tier deployment** from a production service. The current source uses `mysql2` and `drizzle-orm/mysql2`; therefore, a MySQL-compatible hosted database such as TiDB Cloud Starter is the direct no-migration option. Render Postgres would require a deliberate schema and adapter migration before it can be used.
