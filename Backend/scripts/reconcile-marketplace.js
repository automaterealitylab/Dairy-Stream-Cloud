import "../config/loadEnv.js";
import { runMarketplaceReconciliation } from "../services/marketplace/reconciliation.service.js";

const limit = Number(process.argv[2] || process.env.MARKETPLACE_RECONCILIATION_LIMIT || 100);

runMarketplaceReconciliation({ runType: "SCRIPT", limit })
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          status: result.status,
          checked: result.checked_count,
          repaired: result.repaired_count,
          failed: result.failed_count,
          details: result.details,
        },
        null,
        2
      )
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
