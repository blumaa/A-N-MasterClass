export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_groups: {
        Row: {
          challenges: boolean
          community_id: string
          created_at: string
          directory: boolean
          dms: boolean
          id: string
          is_default: boolean
          leaderboard: boolean
          meetups: boolean
          title: string
        }
        Insert: {
          challenges?: boolean
          community_id: string
          created_at?: string
          directory?: boolean
          dms?: boolean
          id?: string
          is_default?: boolean
          leaderboard?: boolean
          meetups?: boolean
          title: string
        }
        Update: {
          challenges?: boolean
          community_id?: string
          created_at?: string
          directory?: boolean
          dms?: boolean
          id?: string
          is_default?: boolean
          leaderboard?: boolean
          meetups?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_groups_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_overrides: {
        Row: {
          date: string
          end_minute: number | null
          id: string
          space_id: string
          start_minute: number | null
        }
        Insert: {
          date: string
          end_minute?: number | null
          id?: string
          space_id: string
          start_minute?: number | null
        }
        Update: {
          date?: string
          end_minute?: number | null
          id?: string
          space_id?: string
          start_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_overrides_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          end_minute: number
          id: string
          space_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          end_minute: number
          id?: string
          space_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          end_minute?: number
          id?: string
          space_id?: string
          start_minute?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          community_id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          community_id: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          community_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          account_email: string
          calendar_id: string
          connected_at: string
          provider: string
          space_id: string
          token_id: string | null
        }
        Insert: {
          account_email: string
          calendar_id: string
          connected_at?: string
          provider?: string
          space_id: string
          token_id?: string | null
        }
        Update: {
          account_email?: string
          calendar_id?: string
          connected_at?: string
          provider?: string
          space_id?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_entries: {
        Row: {
          body: string
          challenge_id: string
          created_at: string
          profile_id: string
        }
        Insert: {
          body: string
          challenge_id: string
          created_at?: string
          profile_id: string
        }
        Update: {
          body?: string
          challenge_id?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          access_group_id: string
          community_id: string
          created_at: string
          description: string
          ends_at: string
          id: string
          prize: string | null
          show_before_start: boolean
          starts_at: string
          title: string
        }
        Insert: {
          access_group_id: string
          community_id: string
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          prize?: string | null
          show_before_start?: boolean
          starts_at: string
          title: string
        }
        Update: {
          access_group_id?: string
          community_id?: string
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          prize?: string | null
          show_before_start?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_access_group_id_fkey"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          profile_id: string
        }
        Insert: {
          channel_id: string
          profile_id: string
        }
        Update: {
          channel_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_moderators: {
        Row: {
          channel_id: string
          profile_id: string
        }
        Insert: {
          channel_id: string
          profile_id: string
        }
        Update: {
          channel_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_moderators_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_moderators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          access_group_id: string
          community_id: string
          created_at: string
          id: string
          kind: string
          position: number
          privacy: string
          read_only: boolean
          title: string
        }
        Insert: {
          access_group_id: string
          community_id: string
          created_at?: string
          id?: string
          kind?: string
          position?: number
          privacy?: string
          read_only?: boolean
          title: string
        }
        Update: {
          access_group_id?: string
          community_id?: string
          created_at?: string
          id?: string
          kind?: string
          position?: number
          privacy?: string
          read_only?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_access_group_id_fkey"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tokens: {
        Row: {
          expires_at: string
          profile_id: string
          space_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          expires_at: string
          profile_id: string
          space_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          expires_at?: string
          profile_id?: string
          space_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_settings: {
        Row: {
          buffer_after_min: number
          buffer_before_min: number
          cancel_cutoff_hours: number
          min_notice_min: number
          space_id: string
          time_zone: string
          window_days: number
        }
        Insert: {
          buffer_after_min?: number
          buffer_before_min?: number
          cancel_cutoff_hours?: number
          min_notice_min?: number
          space_id: string
          time_zone?: string
          window_days?: number
        }
        Update: {
          buffer_after_min?: number
          buffer_before_min?: number
          cancel_cutoff_hours?: number
          min_notice_min?: number
          space_id?: string
          time_zone?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_settings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_programs: {
        Row: {
          kind: string
          location: string | null
          product_id: string
          session_minutes: number
          sessions_included: number
        }
        Insert: {
          kind?: string
          location?: string | null
          product_id: string
          session_minutes?: number
          sessions_included?: number
        }
        Update: {
          kind?: string
          location?: string | null
          product_id?: string
          session_minutes?: number
          sessions_included?: number
        }
        Relationships: [
          {
            foreignKeyName: "coaching_programs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_sessions: {
        Row: {
          agenda: string
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          ends_at: string
          google_event_id: string | null
          id: string
          location: string | null
          product_id: string
          space_id: string
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          agenda?: string
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          ends_at: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          product_id: string
          space_id: string
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          agenda?: string
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          ends_at?: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          product_id?: string
          space_id?: string
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_sessions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          hidden_at: string | null
          id: string
          parent_id: string | null
          space_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          parent_id?: string | null
          space_id: string
          target_id: string
          target_type: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          parent_id?: string | null
          space_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      community_settings: {
        Row: {
          community_id: string
          dms_enabled: boolean
          founder_dms: boolean
          leaderboard: string
          point_values: Json
          points_enabled: boolean
        }
        Insert: {
          community_id: string
          dms_enabled?: boolean
          founder_dms?: boolean
          leaderboard?: string
          point_values?: Json
          points_enabled?: boolean
        }
        Update: {
          community_id?: string
          dms_enabled?: boolean
          founder_dms?: boolean
          leaderboard?: string
          point_values?: Json
          points_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "community_settings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          consent_at: string | null
          consent_source: string | null
          created_at: string
          email: string
          marketing_consent: boolean
          profile_id: string | null
          space_id: string
        }
        Insert: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email: string
          marketing_consent?: boolean
          profile_id?: string | null
          space_id: string
        }
        Update: {
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string
          marketing_consent?: boolean
          profile_id?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reads: {
        Row: {
          profile_id: string
          read_at: string
          thread_id: string
        }
        Insert: {
          profile_id: string
          read_at?: string
          thread_id: string
        }
        Update: {
          profile_id?: string
          read_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          a_id: string
          b_id: string
          community_id: string
          created_at: string
          id: string
        }
        Insert: {
          a_id: string
          b_id: string
          community_id: string
          created_at?: string
          id?: string
        }
        Update: {
          a_id?: string
          b_id?: string
          community_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_threads_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          audio_bytes: number
          audio_path: string
          created_at: string
          duration_s: number | null
          explicit: boolean
          id: string
          product_id: string
          publish_at: string | null
          season: number | null
          show_notes: string
          title: string
          type: string
        }
        Insert: {
          audio_bytes: number
          audio_path: string
          created_at?: string
          duration_s?: number | null
          explicit?: boolean
          id?: string
          product_id: string
          publish_at?: string | null
          season?: number | null
          show_notes?: string
          title: string
          type?: string
        }
        Update: {
          audio_bytes?: number
          audio_path?: string
          created_at?: string
          duration_s?: number | null
          explicit?: boolean
          id?: string
          product_id?: string
          publish_at?: string | null
          season?: number | null
          show_notes?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          access_group_id: string | null
          expires_at: string | null
          granted_at: string
          id: string
          order_id: string | null
          product_id: string
          profile_id: string
          source: string
          status: string
        }
        Insert: {
          access_group_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          profile_id: string
          source: string
          status?: string
        }
        Update: {
          access_group_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          profile_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_access_group"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_rsvps: {
        Row: {
          created_at: string
          meetup_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          meetup_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          meetup_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_rsvps_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_rsvps_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          access_group_id: string
          channel_id: string | null
          community_id: string
          created_at: string
          description: string
          ends_at: string
          id: string
          location: string
          replay_vimeo_id: string | null
          starts_at: string
          time_zone: string
          title: string
        }
        Insert: {
          access_group_id: string
          channel_id?: string | null
          community_id: string
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          location: string
          replay_vimeo_id?: string | null
          starts_at: string
          time_zone?: string
          title: string
        }
        Update: {
          access_group_id?: string
          channel_id?: string | null
          community_id?: string
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          location?: string
          replay_vimeo_id?: string | null
          starts_at?: string
          time_zone?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetups_access_group_id_fkey"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          attachment_type: string | null
          author_id: string
          body: string
          channel_id: string | null
          created_at: string
          id: string
          thread_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          author_id: string
          body: string
          channel_id?: string | null
          created_at?: string
          id?: string
          thread_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          author_id?: string
          body?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          program_id: string
          release_after_days: number | null
          release_at: string | null
          status: string
          title: string
          unlock_after_step_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          program_id: string
          release_after_days?: number | null
          release_at?: string | null
          status?: string
          title: string
          unlock_after_step_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          program_id?: string
          release_after_days?: number | null
          release_at?: string | null
          status?: string
          title?: string
          unlock_after_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "modules_unlock_after_step_fk"
            columns: ["unlock_after_step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read_at: string | null
          recipient_id: string
          space_id: string
          step_id: string | null
          type: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          recipient_id: string
          space_id: string
          step_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read_at?: string | null
          recipient_id?: string
          space_id?: string
          step_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_products: {
        Row: {
          access_group_id: string | null
          offer_id: string
          product_id: string
        }
        Insert: {
          access_group_id?: string | null
          offer_id: string
          product_id: string
        }
        Update: {
          access_group_id?: string | null
          offer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_products_access_group"
            columns: ["access_group_id"]
            isOneToOne: false
            referencedRelation: "access_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_products_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          access_days: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          kind: string
          price_cents: number
          slug: string
          space_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          access_days?: number | null
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          kind?: string
          price_cents: number
          slug: string
          space_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          access_days?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          price_cents?: number
          slug?: string
          space_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          capture_id: string | null
          created_at: string
          currency: string
          email: string
          id: string
          livemode: boolean
          marketing_consent: boolean
          offer_id: string
          paid_at: string | null
          profile_id: string | null
          provider: string
          provider_order_id: string
          space_id: string
          status: string
          waiver_accepted_at: string
          waiver_version: string
        }
        Insert: {
          amount_cents: number
          capture_id?: string | null
          created_at?: string
          currency: string
          email: string
          id?: string
          livemode: boolean
          marketing_consent?: boolean
          offer_id: string
          paid_at?: string | null
          profile_id?: string | null
          provider: string
          provider_order_id: string
          space_id: string
          status?: string
          waiver_accepted_at: string
          waiver_version: string
        }
        Update: {
          amount_cents?: number
          capture_id?: string | null
          created_at?: string
          currency?: string
          email?: string
          id?: string
          livemode?: boolean
          marketing_consent?: boolean
          offer_id?: string
          paid_at?: string | null
          profile_id?: string | null
          provider?: string
          provider_order_id?: string
          space_id?: string
          status?: string
          waiver_accepted_at?: string
          waiver_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      page_versions: {
        Row: {
          id: string
          page_id: string
          published_at: string
          sections: Json
        }
        Insert: {
          id?: string
          page_id: string
          published_at?: string
          sections: Json
        }
        Update: {
          id?: string
          page_id?: string
          published_at?: string
          sections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "published_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          draft: Json
          id: string
          is_home: boolean
          kind: string
          legal_kind: string | null
          published: Json | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft?: Json
          id?: string
          is_home?: boolean
          kind?: string
          legal_kind?: string | null
          published?: Json | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft?: Json
          id?: string
          is_home?: boolean
          kind?: string
          legal_kind?: string | null
          published?: Json | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          aspect: number | null
          body: Json | null
          created_at: string
          duration_s: number | null
          file_path: string | null
          file_size: number | null
          id: string
          kind: string
          position: number
          poster_path: string | null
          step_id: string
          title: string | null
          vimeo_id: string | null
        }
        Insert: {
          aspect?: number | null
          body?: Json | null
          created_at?: string
          duration_s?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind: string
          position?: number
          poster_path?: string | null
          step_id: string
          title?: string | null
          vimeo_id?: string | null
        }
        Update: {
          aspect?: number | null
          body?: Json | null
          created_at?: string
          duration_s?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          position?: number
          poster_path?: string | null
          step_id?: string
          title?: string | null
          vimeo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_credentials: {
        Row: {
          client_id: string
          env: string
          provider: string
          secret_id: string | null
          space_id: string
          updated_at: string
          webhook_id: string | null
        }
        Insert: {
          client_id: string
          env: string
          provider?: string
          secret_id?: string | null
          space_id: string
          updated_at?: string
          webhook_id?: string | null
        }
        Update: {
          client_id?: string
          env?: string
          provider?: string
          secret_id?: string | null
          space_id?: string
          updated_at?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_credentials_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_feeds: {
        Row: {
          created_at: string
          product_id: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          product_id: string
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          product_id?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_feeds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_feeds_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_settings: {
        Row: {
          author: string
          episode_order: string
          explicit: boolean
          product_id: string
        }
        Insert: {
          author?: string
          episode_order?: string
          explicit?: boolean
          product_id: string
        }
        Update: {
          author?: string
          episode_order?: string
          explicit?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          community_id: string
          created_at: string
          points: number
          profile_id: string
          reason: string
          source_key: string
        }
        Insert: {
          community_id: string
          created_at?: string
          points: number
          profile_id: string
          reason: string
          source_key: string
        }
        Update: {
          community_id?: string
          created_at?: string
          points?: number
          profile_id?: string
          reason?: string
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_photos: {
        Row: {
          created_at: string
          id: string
          path: string
          position: number
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          position?: number
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          channel_id: string
          created_at: string
          hidden_at: string | null
          id: string
          pinned: boolean
        }
        Insert: {
          author_id: string
          body: string
          channel_id: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          pinned?: boolean
        }
        Update: {
          author_id?: string
          body?: string
          channel_id?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      product_files: {
        Row: {
          created_at: string
          file_path: string
          id: string
          product_id: string
          size_bytes: number
          title: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          product_id: string
          size_bytes: number
          title: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          product_id?: string
          size_bytes?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cover_path: string | null
          created_at: string
          id: string
          kind: string
          position: number
          slug: string
          space_id: string
          status: string
          subtitle: string | null
          theme_override: Json | null
          title: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          id?: string
          kind: string
          position?: number
          slug: string
          space_id: string
          status?: string
          subtitle?: string | null
          theme_override?: Json | null
          title: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          id?: string
          kind?: string
          position?: number
          slug?: string
          space_id?: string
          status?: string
          subtitle?: string | null
          theme_override?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_platform_admin: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_platform_admin?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_platform_admin?: boolean
        }
        Relationships: []
      }
      programs: {
        Row: {
          community_product_id: string | null
          product_id: string
        }
        Insert: {
          community_product_id?: string | null
          product_id: string
        }
        Update: {
          community_product_id?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_community_product_id_fkey"
            columns: ["community_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
          space_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
          space_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
          space_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          profile_id: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          emoji: string
          profile_id: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          emoji?: string
          profile_id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          channel_id: string
          community_id: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          channel_id: string
          community_id: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          channel_id?: string
          community_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability: string
          role: string
        }
        Insert: {
          capability: string
          role: string
        }
        Update: {
          capability?: string
          role?: string
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          body: string
          session_id: string
          updated_at: string
        }
        Insert: {
          body: string
          session_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "coaching_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_nav: {
        Row: {
          footer: Json
          header: Json
          space_id: string
          updated_at: string
        }
        Insert: {
          footer?: Json
          header?: Json
          space_id: string
          updated_at?: string
        }
        Update: {
          footer?: Json
          header?: Json
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_nav_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_branding: {
        Row: {
          colors: Json | null
          favicon_path: string | null
          font_body: string | null
          font_heading: string | null
          logo_path: string | null
          space_id: string
          updated_at: string
        }
        Insert: {
          colors?: Json | null
          favicon_path?: string | null
          font_body?: string | null
          font_heading?: string | null
          logo_path?: string | null
          space_id: string
          updated_at?: string
        }
        Update: {
          colors?: Json | null
          favicon_path?: string | null
          font_body?: string | null
          font_heading?: string | null
          logo_path?: string | null
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_branding_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_domains: {
        Row: {
          created_at: string
          host: string
          is_primary: boolean
          space_id: string
        }
        Insert: {
          created_at?: string
          host: string
          is_primary?: boolean
          space_id: string
        }
        Update: {
          created_at?: string
          host?: string
          is_primary?: boolean
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_domains_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_member_communities: {
        Row: {
          community_id: string
          profile_id: string
        }
        Insert: {
          community_id: string
          profile_id: string
        }
        Update: {
          community_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_member_communities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_member_communities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          profile_id: string
          role: string
          space_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role: string
          space_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          profile_id: string
          space_id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          profile_id: string
          space_id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          profile_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_profiles_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          id: string
          is_test: boolean
          locale: string
          name: string
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_test?: boolean
          locale?: string
          name: string
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_test?: boolean
          locale?: string
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      step_progress: {
        Row: {
          completed_at: string
          profile_id: string
          step_id: string
        }
        Insert: {
          completed_at?: string
          profile_id: string
          step_id: string
        }
        Update: {
          completed_at?: string
          profile_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module_id: string
          position: number
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module_id: string
          position?: number
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module_id?: string
          position?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "steps_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      video_position: {
        Row: {
          last_position_s: number
          part_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          last_position_s: number
          part_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          last_position_s?: number
          part_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_position_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_position_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      published_pages: {
        Row: {
          id: string | null
          is_home: boolean | null
          kind: string | null
          legal_kind: string | null
          published: Json | null
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          space_id: string | null
          title: string | null
        }
        Insert: {
          id?: string | null
          is_home?: boolean | null
          kind?: string | null
          legal_kind?: string | null
          published?: Json | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          space_id?: string | null
          title?: string | null
        }
        Update: {
          id?: string | null
          is_home?: boolean | null
          kind?: string | null
          legal_kind?: string | null
          published?: Json | null
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          space_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      active_grant_at: { Args: { target_product: string }; Returns: string }
      award_points: {
        Args: {
          at: string
          reason: string
          source_key: string
          target_community: string
          target_profile: string
        }
        Returns: undefined
      }
      book_coaching_session: {
        Args: {
          agenda: string
          ends: string
          starts: string
          target_product: string
        }
        Returns: {
          agenda: string
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          ends_at: string
          google_event_id: string | null
          id: string
          location: string | null
          product_id: string
          space_id: string
          starts_at: string
          status: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "coaching_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calendar_token: { Args: { target_space: string }; Returns: string }
      can_edit_community: {
        Args: { target_community: string }
        Returns: boolean
      }
      can_join_live: { Args: { topic: string }; Returns: boolean }
      can_moderate_channel: {
        Args: { target_channel: string }
        Returns: boolean
      }
      can_moderate_comment_target: {
        Args: { t_id: string; t_type: string }
        Returns: boolean
      }
      can_moderate_comments: {
        Args: { target_community: string }
        Returns: boolean
      }
      can_moderate_posts: {
        Args: { target_community: string }
        Returns: boolean
      }
      can_post_in: { Args: { target_channel: string }; Returns: boolean }
      can_read_challenge: {
        Args: { target_challenge: string }
        Returns: boolean
      }
      can_read_channel: { Args: { target_channel: string }; Returns: boolean }
      can_read_comment: { Args: { target_comment: string }; Returns: boolean }
      can_read_comment_target: {
        Args: { t_id: string; t_type: string }
        Returns: boolean
      }
      can_read_community: {
        Args: { target_community: string }
        Returns: boolean
      }
      can_read_meetup: { Args: { target_meetup: string }; Returns: boolean }
      can_read_post: { Args: { target_post: string }; Returns: boolean }
      can_read_report_target: {
        Args: { t_id: string; t_type: string }
        Returns: boolean
      }
      can_read_step: { Args: { target_step: string }; Returns: boolean }
      can_reply_dm: {
        Args: { other: string; target_community: string }
        Returns: boolean
      }
      can_send_dm: { Args: { target_thread: string }; Returns: boolean }
      can_start_dm: {
        Args: { other: string; target_community: string }
        Returns: boolean
      }
      challenge_entry_count: {
        Args: { target_challenge: string }
        Returns: number
      }
      challenge_open: { Args: { target_challenge: string }; Returns: boolean }
      change_coaching_session: {
        Args: { new_start: string; target_session: string }
        Returns: {
          agenda: string
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          ends_at: string
          google_event_id: string | null
          id: string
          location: string | null
          product_id: string
          space_id: string
          starts_at: string
          status: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "coaching_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      channel_community: { Args: { target_channel: string }; Returns: string }
      channel_files: { Args: { target_channel: string }; Returns: string[] }
      channel_folder: { Args: { target_channel: string }; Returns: string }
      coaching_busy: {
        Args: { from_at: string; target_space: string; to_at: string }
        Returns: {
          ends_at: string
          id: string
          starts_at: string
        }[]
      }
      comment_target_space: {
        Args: { t_id: string; t_type: string }
        Returns: string
      }
      community_feature: {
        Args: { feature: string; target_community: string }
        Returns: boolean
      }
      consume_claim_token: {
        Args: { hash: string; target_space: string }
        Returns: {
          expires_at: string
          profile_id: string
          space_id: string
          token_hash: string
          used_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "claim_tokens"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      default_group: { Args: { target_community: string }; Returns: string }
      fulfil_order: {
        Args: {
          buyer: string
          capture: string
          display_name: string
          target_order: string
        }
        Returns: {
          amount_cents: number
          capture_id: string | null
          created_at: string
          currency: string
          email: string
          id: string
          livemode: boolean
          marketing_consent: boolean
          offer_id: string
          paid_at: string | null
          profile_id: string | null
          provider: string
          provider_order_id: string
          space_id: string
          status: string
          waiver_accepted_at: string
          waiver_version: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_capability: {
        Args: { cap: string; target_space: string }
        Returns: boolean
      }
      has_grant: { Args: { target_product: string }; Returns: boolean }
      has_space_profile: {
        Args: { target_profile: string; target_space: string }
        Returns: boolean
      }
      in_folder: { Args: { folder: string; path: string }; Returns: boolean }
      is_brand_colors: { Args: { c: Json }; Returns: boolean }
      is_channel_moderator: {
        Args: { target_channel: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { target_community: string; target_profile: string }
        Returns: boolean
      }
      is_dm_participant: { Args: { target_thread: string }; Returns: boolean }
      is_nav_items: { Args: { n: Json }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_point_values: { Args: { v: Json }; Returns: boolean }
      is_site_sections: { Args: { s: Json }; Returns: boolean }
      is_space_participant: { Args: { target_space: string }; Returns: boolean }
      is_space_staff: { Args: { target_space: string }; Returns: boolean }
      is_time_zone: { Args: { zone: string }; Returns: boolean }
      live_post_topics: { Args: { target_post: string }; Returns: string[] }
      live_send: { Args: { topic: string }; Returns: undefined }
      live_topics: { Args: { r: Json; tbl: string }; Returns: string[] }
      meetup_join_url: { Args: { target_meetup: string }; Returns: string }
      meetup_rsvp_count: { Args: { target_meetup: string }; Returns: number }
      member_groups: { Args: { target_community: string }; Returns: string[] }
      move_row: {
        Args: { direction: string; target_id: string; target_table: string }
        Returns: undefined
      }
      payment_secret: {
        Args: { target_env: string; target_space: string }
        Returns: string
      }
      podcast_feed: {
        Args: { target_token: string }
        Returns: {
          created_at: string
          product_id: string
          profile_id: string
          token: string
        }[]
        SetofOptions: {
          from: "*"
          to: "podcast_feeds"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      podcast_feed_token: { Args: { target_product: string }; Returns: string }
      point_totals: {
        Args: { since: string; target_community: string }
        Returns: {
          points: number
          profile_id: string
        }[]
      }
      point_value: {
        Args: { reason: string; target_community: string }
        Returns: number
      }
      post_channel: { Args: { target_post: string }; Returns: string }
      post_community: { Args: { target_post: string }; Returns: string }
      product_space: { Args: { target_product: string }; Returns: string }
      program_progress: {
        Args: { target_program: string }
        Returns: {
          completed: number
          total: number
        }[]
      }
      reaches_community: {
        Args: { target_community: string }
        Returns: boolean
      }
      reaches_group: {
        Args: { target_community: string; target_group: string }
        Returns: boolean
      }
      report_reporters: {
        Args: { target_community: string }
        Returns: {
          report_id: string
          reporter_id: string
        }[]
      }
      report_target_channel: {
        Args: { t_id: string; t_type: string }
        Returns: string
      }
      reset_podcast_feed: { Args: { target_product: string }; Returns: string }
      save_calendar_connection: {
        Args: {
          calendar: string
          email: string
          target_space: string
          token: string
        }
        Returns: undefined
      }
      save_payment_secret: {
        Args: { secret: string; target_env: string; target_space: string }
        Returns: undefined
      }
      save_push_subscription: {
        Args: {
          agent: string
          key_auth: string
          key_p256dh: string
          target_endpoint: string
          target_space: string
        }
        Returns: undefined
      }
      sees_leaderboard: { Args: { target_community: string }; Returns: boolean }
      set_order_status: {
        Args: { new_status: string; target_order: string }
        Returns: {
          amount_cents: number
          capture_id: string | null
          created_at: string
          currency: string
          email: string
          id: string
          livemode: boolean
          marketing_consent: boolean
          offer_id: string
          paid_at: string | null
          profile_id: string | null
          provider: string
          provider_order_id: string
          space_id: string
          status: string
          waiver_accepted_at: string
          waiver_version: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_session_event: {
        Args: { event_id: string; target_session: string }
        Returns: undefined
      }
      space_role: { Args: { target_space: string }; Returns: string }
      step_space: { Args: { target_step: string }; Returns: string }
      thread_folder: { Args: { target_thread: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
