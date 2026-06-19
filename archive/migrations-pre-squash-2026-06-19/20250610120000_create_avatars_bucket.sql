/*
          # [Operation Name]
          Create Avatars Storage Bucket

          ## Query Description: [This script creates a new public storage bucket named 'avatars' for storing user profile pictures. If the bucket already exists, it does nothing. This allows users to upload and display their avatars across the application.]
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [false]
          
          ## Structure Details:
          - Creates a new bucket in the 'storage' schema.
          
          ## Security Implications:
          - RLS Status: [Not Applicable for bucket creation]
          - Policy Changes: [No]
          - Auth Requirements: [Admin privileges to run]
          
          ## Performance Impact:
          - Indexes: [None]
          - Triggers: [None]
  - Estimated Impact: [None]
*/
-- Create a public bucket for user avatars if it doesn't exist.
-- This allows for easy retrieval of public URLs for profile pictures.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

/*
  NOTE: This bucket is made public for simplicity. For a production environment,
  it is highly recommended to set the bucket to private and use Row Level Security (RLS)
  to control access, allowing users to upload/update their own avatars while
  still allowing public read access.
*/
