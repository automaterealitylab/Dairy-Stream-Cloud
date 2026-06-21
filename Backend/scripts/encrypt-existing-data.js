/**
				 * Run-once data migration script to encrypt existing plaintext PII and financial fields.
				 * Supports large datasets with keyset pagination and high-performance batch updates.
				 * Run: node Backend/scripts/encrypt-existing-data.js
				 */

import { supabase } from "../config/supabase.js";
import { encryptDeterministic } from "../utils/crypto.js";
import "../config/loadEnv.js";

async function updateRow(tableName, idColumn, idVal, updateFields) {
  const { error } = await supabase
    .from(tableName)
    .update(updateFields)
    .eq(idColumn, idVal);
  if (error) {
    throw new Error(`Failed to update id ${idVal}: ${error.message}`);
  }
}

async function migrateTable(tableName, idColumn, fieldsToEncrypt) {
  console.log(`\n--- Starting migration for table: ${tableName} ---`);
  
  let lastId = 0;
  let hasMore = true;
  let totalProcessed = 0;
  let totalUpdatesCount = 0;
  let totalSuccessfulUpdates = 0;

  const pageSize = 200;

  while (hasMore) {
    const { data: rows, error: fetchError } = await supabase
      .from(tableName)
      .select("*")
      .gt(idColumn, lastId)
      .order(idColumn, { ascending: true })
      .limit(pageSize);

    if (fetchError) {
      console.error(`Error fetching rows from ${tableName}:`, fetchError.message);
      break;
    }

    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    totalProcessed += rows.length;
    lastId = rows[rows.length - 1][idColumn];

    const rowsToUpsert = [];
    let fieldsEncryptedInPage = 0;

    for (const row of rows) {
      let rowNeedsUpdate = false;
      const updatedRow = { ...row };

      for (const field of fieldsToEncrypt) {
        const val = row[field];
        if (val !== null && val !== undefined) {
          const strVal = String(val).trim();
          if (strVal && !strVal.startsWith("ENC_DET:")) {
            updatedRow[field] = encryptDeterministic(strVal);
            rowNeedsUpdate = true;
            fieldsEncryptedInPage++;
          }
        }
      }

      if (rowNeedsUpdate) {
        rowsToUpsert.push(updatedRow);
      }
    }

    if (rowsToUpsert.length > 0) {
      totalUpdatesCount += rowsToUpsert.length;
      
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(rowsToUpsert, { onConflict: idColumn });

      if (upsertError) {
        console.warn(`Warning: Bulk upsert failed for ${tableName} page, falling back to row-by-row update:`, upsertError.message);
        
        // Fallback: update row-by-row for the affected chunk
        for (const item of rowsToUpsert) {
          const idVal = item[idColumn];
          const updateFields = {};
          for (const field of fieldsToEncrypt) {
            updateFields[field] = item[field];
          }
          try {
            await updateRow(tableName, idColumn, idVal, updateFields);
            totalSuccessfulUpdates++;
          } catch (err) {
            console.error(`Fallback failed to update row ${idVal}:`, err.message);
          }
        }
      } else {
        totalSuccessfulUpdates += rowsToUpsert.length;
      }
    }

    if (totalProcessed % 5000 === 0 || rows.length < pageSize) {
      console.log(`Table ${tableName}: processed ${totalProcessed} rows so far (updated ${totalSuccessfulUpdates} rows)...`);
    }
  }

  console.log(`✓ Migration completed for ${tableName}. Processed: ${totalProcessed}, Found Needing Update: ${totalUpdatesCount}, Successfully Updated: ${totalSuccessfulUpdates}`);
}

async function run() {
  if (!process.env.DATA_ENCRYPTION_KEY) {
    console.error("Error: DATA_ENCRYPTION_KEY environment variable is not defined!");
    process.exit(1);
  }

  try {
    // 1. Migrate customers
    await migrateTable("customers", "id", ["email", "phone_number", "phone"]);

    // 2. Migrate dairies
    await migrateTable("dairies", "id", [
      "dairy_phone",
      "dairy_email",
      "phone",
      "email",
      "bank_ifsc_code",
      "ifsc",
      "bank_branch",
      "pan",
      "bank_account"
    ]);

    // 3. Migrate admins
    await migrateTable("admins", "id", ["email", "phone", "phone_number"]);

    // 4. Migrate agents
    await migrateTable("agents", "id", ["email", "phone_number"]);

    console.log("\n====== Database PII Encryption Migration Complete ======\n");
    process.exit(0);
  } catch (err) {
    console.error("Migration script crashed:", err);
    process.exit(1);
  }
}

run();
