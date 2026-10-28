require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in backend/.env"
    );
}

const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey
);

module.exports = supabase;