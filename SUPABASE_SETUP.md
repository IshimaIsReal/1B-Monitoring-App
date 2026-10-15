# Shared reports with Supabase

GitHub Pages serves static files; it does not provide a shared database. This project uses Supabase Auth and Postgres so reports are available across devices. Reports are private to their submitter and administrators. Only administrators can change report status or view the account list.

## Configure the project

1. Create a Supabase project and open **SQL Editor**.
2. Run the contents of [`supabase-setup.sql`](./supabase-setup.sql).
3. In Supabase **Project Settings → API**, copy the Project URL and the publishable key (or legacy `anon` key) into [`supabase-config.js`](./supabase-config.js). These are browser-safe values when row-level security is enabled. Never put a `service_role` key or database password in this project.
4. In **Authentication → URL Configuration**, set the Site URL to your deployed GitHub Pages URL and add that URL to the allowed redirect URLs. Also add the local development URL you use, if applicable.
5. If your project restricts Data API access to selected tables, expose `profiles` and `reports`. The SQL script grants the required authenticated-role table permissions.
6. Sign up for the account you want to use as administrator. In the SQL Editor, grant it the admin role:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'your-admin-email@example.com';
   ```

7. If email confirmation is enabled, confirm the account using the email Supabase sends. Log in with that account to open the admin dashboard. There is no built-in admin password.

After configuration, deploy the updated files to GitHub Pages. Each user must create a Supabase-backed account; the old browser-only accounts and reports are not automatically migrated.
