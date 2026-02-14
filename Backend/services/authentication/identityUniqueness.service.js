import { supabase } from "../../config/supabase.js";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const buildConflictMessage = ({ emailTakenBy, phoneTakenBy }) => {
  const issues = [];

  if (emailTakenBy) {
    issues.push(`Email is already used by an existing ${emailTakenBy} account`);
  }

  if (phoneTakenBy) {
    issues.push(`Mobile number is already used by an existing ${phoneTakenBy} account`);
  }

  return issues.join(". ");
};

export const findIdentityConflicts = async ({ email, phone }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhoneDigits(phone);

  const [
    { data: customerByEmail, error: customerByEmailError },
    { data: adminByEmail, error: adminByEmailError },
    { data: customersWithPhone, error: customersPhoneError },
    { data: adminsWithPhone, error: adminsPhoneError },
  ] = await Promise.all([
    normalizedEmail
      ? supabase
          .from("customers")
          .select("id, email")
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    normalizedEmail
      ? supabase
          .from("admins")
          .select("id, email")
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    normalizedPhone
      ? supabase
          .from("customers")
          .select("id, phone_number")
          .not("phone_number", "is", null)
      : Promise.resolve({ data: [], error: null }),
    normalizedPhone
      ? supabase
          .from("admins")
          .select("id, phone")
          .not("phone", "is", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customerByEmailError) throw customerByEmailError;
  if (adminByEmailError) throw adminByEmailError;
  if (customersPhoneError) throw customersPhoneError;
  if (adminsPhoneError) throw adminsPhoneError;

  const customerPhoneMatch = (customersWithPhone || []).find(
    (row) => normalizePhoneDigits(row.phone_number) === normalizedPhone
  );
  const adminPhoneMatch = (adminsWithPhone || []).find(
    (row) => normalizePhoneDigits(row.phone) === normalizedPhone
  );

  return {
    emailTakenBy: customerByEmail ? "customer" : adminByEmail ? "admin" : null,
    phoneTakenBy: customerPhoneMatch ? "customer" : adminPhoneMatch ? "admin" : null,
  };
};

export const ensureIdentityIsUnique = async ({ email, phone }) => {
  const conflict = await findIdentityConflicts({ email, phone });

  if (conflict.emailTakenBy || conflict.phoneTakenBy) {
    const error = new Error(buildConflictMessage(conflict));
    error.statusCode = 409;
    error.conflict = conflict;
    throw error;
  }
};
