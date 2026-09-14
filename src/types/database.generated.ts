// AUTO-GENERATED from the LIVE self-hosted Postgres schema. DO NOT EDIT BY HAND.
// Regenerate:  npm run gen:types   (see scripts/db/gen-types.sh)
// Source of truth: supabase.orangecat.ch — postgres-meta /generators/typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      _backup_cat_conversations_20260703: {
        Row: {
          created_at: string | null;
          id: string | null;
          is_default: boolean | null;
          title: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string | null;
          is_default?: boolean | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string | null;
          is_default?: boolean | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      _backup_cat_messages_20260703: {
        Row: {
          content: string | null;
          conversation_id: string | null;
          created_at: string | null;
          id: string | null;
          model_used: string | null;
          provider: string | null;
          role: string | null;
          token_count: number | null;
          user_id: string | null;
        };
        Insert: {
          content?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          model_used?: string | null;
          provider?: string | null;
          role?: string | null;
          token_count?: number | null;
          user_id?: string | null;
        };
        Update: {
          content?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string | null;
          model_used?: string | null;
          provider?: string | null;
          role?: string | null;
          token_count?: number | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      actors: {
        Row: {
          actor_type: string;
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          group_id: string | null;
          id: string;
          slug: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          actor_type: string;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          group_id?: string | null;
          id?: string;
          slug?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          actor_type?: string;
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          group_id?: string | null;
          id?: string;
          slug?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'actors_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_assistants: {
        Row: {
          actor_id: string;
          allowed_models: string[] | null;
          api_provider: string | null;
          avatar_url: string | null;
          average_rating: number | null;
          bitcoin_address: string | null;
          category: string | null;
          compute_provider_id: string | null;
          compute_provider_type: Database['public']['Enums']['compute_provider_type'] | null;
          created_at: string | null;
          default_model: string | null;
          description: string | null;
          free_messages_per_day: number | null;
          id: string;
          is_featured: boolean | null;
          is_public: boolean | null;
          knowledge_base_urls: string[] | null;
          lightning_address: string | null;
          max_tokens_per_response: number | null;
          min_model_tier: string | null;
          model_preference: string | null;
          personality_traits: string[] | null;
          price_per_1k_tokens: number | null;
          price_per_message: number | null;
          pricing_model: Database['public']['Enums']['ai_pricing_model'] | null;
          published_at: string | null;
          show_on_profile: boolean | null;
          status: Database['public']['Enums']['ai_assistant_status'] | null;
          subscription_price: number | null;
          system_prompt: string;
          tags: string[] | null;
          temperature: number | null;
          title: string;
          total_conversations: number | null;
          total_revenue: number | null;
          total_withdrawn_btc: number | null;
          updated_at: string | null;
          user_id: string;
          welcome_message: string | null;
        };
        Insert: {
          actor_id: string;
          allowed_models?: string[] | null;
          api_provider?: string | null;
          avatar_url?: string | null;
          average_rating?: number | null;
          bitcoin_address?: string | null;
          category?: string | null;
          compute_provider_id?: string | null;
          compute_provider_type?: Database['public']['Enums']['compute_provider_type'] | null;
          created_at?: string | null;
          default_model?: string | null;
          description?: string | null;
          free_messages_per_day?: number | null;
          id?: string;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          knowledge_base_urls?: string[] | null;
          lightning_address?: string | null;
          max_tokens_per_response?: number | null;
          min_model_tier?: string | null;
          model_preference?: string | null;
          personality_traits?: string[] | null;
          price_per_1k_tokens?: number | null;
          price_per_message?: number | null;
          pricing_model?: Database['public']['Enums']['ai_pricing_model'] | null;
          published_at?: string | null;
          show_on_profile?: boolean | null;
          status?: Database['public']['Enums']['ai_assistant_status'] | null;
          subscription_price?: number | null;
          system_prompt: string;
          tags?: string[] | null;
          temperature?: number | null;
          title: string;
          total_conversations?: number | null;
          total_revenue?: number | null;
          total_withdrawn_btc?: number | null;
          updated_at?: string | null;
          user_id: string;
          welcome_message?: string | null;
        };
        Update: {
          actor_id?: string;
          allowed_models?: string[] | null;
          api_provider?: string | null;
          avatar_url?: string | null;
          average_rating?: number | null;
          bitcoin_address?: string | null;
          category?: string | null;
          compute_provider_id?: string | null;
          compute_provider_type?: Database['public']['Enums']['compute_provider_type'] | null;
          created_at?: string | null;
          default_model?: string | null;
          description?: string | null;
          free_messages_per_day?: number | null;
          id?: string;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          knowledge_base_urls?: string[] | null;
          lightning_address?: string | null;
          max_tokens_per_response?: number | null;
          min_model_tier?: string | null;
          model_preference?: string | null;
          personality_traits?: string[] | null;
          price_per_1k_tokens?: number | null;
          price_per_message?: number | null;
          pricing_model?: Database['public']['Enums']['ai_pricing_model'] | null;
          published_at?: string | null;
          show_on_profile?: boolean | null;
          status?: Database['public']['Enums']['ai_assistant_status'] | null;
          subscription_price?: number | null;
          system_prompt?: string;
          tags?: string[] | null;
          temperature?: number | null;
          title?: string;
          total_conversations?: number | null;
          total_revenue?: number | null;
          total_withdrawn_btc?: number | null;
          updated_at?: string | null;
          user_id?: string;
          welcome_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_assistants_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_assistants_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_conversations: {
        Row: {
          assistant_id: string;
          created_at: string | null;
          id: string;
          last_message_at: string | null;
          status: string | null;
          title: string | null;
          total_cost_btc: number | null;
          total_messages: number | null;
          total_tokens_used: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          assistant_id: string;
          created_at?: string | null;
          id?: string;
          last_message_at?: string | null;
          status?: string | null;
          title?: string | null;
          total_cost_btc?: number | null;
          total_messages?: number | null;
          total_tokens_used?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          assistant_id?: string;
          created_at?: string | null;
          id?: string;
          last_message_at?: string | null;
          status?: string | null;
          title?: string | null;
          total_cost_btc?: number | null;
          total_messages?: number | null;
          total_tokens_used?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_conversations_assistant_id_fkey';
            columns: ['assistant_id'];
            referencedRelation: 'ai_assistants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_conversations_assistant_id_fkey';
            columns: ['assistant_id'];
            referencedRelation: 'ai_cost_analytics';
            referencedColumns: ['assistant_id'];
          },
        ];
      };
      ai_creator_earnings: {
        Row: {
          available_balance_btc: number | null;
          created_at: string | null;
          id: string;
          pending_withdrawal_btc: number | null;
          total_earned_btc: number | null;
          total_withdrawn_btc: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          available_balance_btc?: number | null;
          created_at?: string | null;
          id?: string;
          pending_withdrawal_btc?: number | null;
          total_earned_btc?: number | null;
          total_withdrawn_btc?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          available_balance_btc?: number | null;
          created_at?: string | null;
          id?: string;
          pending_withdrawal_btc?: number | null;
          total_earned_btc?: number | null;
          total_withdrawn_btc?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_creator_withdrawals: {
        Row: {
          amount_btc: number;
          created_at: string | null;
          failure_reason: string | null;
          fee_btc: number | null;
          id: string;
          lightning_address: string | null;
          net_amount_btc: number | null;
          payment_hash: string | null;
          payment_preimage: string | null;
          processed_at: string | null;
          status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          amount_btc: number;
          created_at?: string | null;
          failure_reason?: string | null;
          fee_btc?: number | null;
          id?: string;
          lightning_address?: string | null;
          net_amount_btc?: number | null;
          payment_hash?: string | null;
          payment_preimage?: string | null;
          processed_at?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          amount_btc?: number;
          created_at?: string | null;
          failure_reason?: string | null;
          fee_btc?: number | null;
          id?: string;
          lightning_address?: string | null;
          net_amount_btc?: number | null;
          payment_hash?: string | null;
          payment_preimage?: string | null;
          processed_at?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          api_cost_btc: number | null;
          content: string;
          conversation_id: string;
          cost_btc: number | null;
          created_at: string | null;
          creator_markup_btc: number | null;
          id: string;
          metadata: Json | null;
          model_used: string | null;
          role: string;
          tokens_used: number | null;
        };
        Insert: {
          api_cost_btc?: number | null;
          content: string;
          conversation_id: string;
          cost_btc?: number | null;
          created_at?: string | null;
          creator_markup_btc?: number | null;
          id?: string;
          metadata?: Json | null;
          model_used?: string | null;
          role: string;
          tokens_used?: number | null;
        };
        Update: {
          api_cost_btc?: number | null;
          content?: string;
          conversation_id?: string;
          cost_btc?: number | null;
          created_at?: string | null;
          creator_markup_btc?: number | null;
          id?: string;
          metadata?: Json | null;
          model_used?: string | null;
          role?: string;
          tokens_used?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'ai_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      allocation_policies: {
        Row: {
          activated_at: string | null;
          content: Json;
          content_hash: string;
          created_at: string;
          decision_document: Json | null;
          id: string;
          policy_key: string;
          solon_decision_id: string | null;
          solon_proposal_id: string | null;
          status: string;
          verified_at: string | null;
          version: number;
        };
        Insert: {
          activated_at?: string | null;
          content: Json;
          content_hash: string;
          created_at?: string;
          decision_document?: Json | null;
          id?: string;
          policy_key: string;
          solon_decision_id?: string | null;
          solon_proposal_id?: string | null;
          status?: string;
          verified_at?: string | null;
          version: number;
        };
        Update: {
          activated_at?: string | null;
          content?: Json;
          content_hash?: string;
          created_at?: string;
          decision_document?: Json | null;
          id?: string;
          policy_key?: string;
          solon_decision_id?: string | null;
          solon_proposal_id?: string | null;
          status?: string;
          verified_at?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      asset_availability: {
        Row: {
          asset_id: string;
          available_from: string;
          available_to: string | null;
          blocked_dates: Json | null;
          created_at: string | null;
          id: string;
          is_available: boolean | null;
          max_rental_hours: number | null;
          min_rental_hours: number | null;
          provider_actor_id: string;
          rental_price_per_day_btc: number | null;
          rental_price_per_hour_btc: number | null;
          updated_at: string | null;
        };
        Insert: {
          asset_id: string;
          available_from: string;
          available_to?: string | null;
          blocked_dates?: Json | null;
          created_at?: string | null;
          id?: string;
          is_available?: boolean | null;
          max_rental_hours?: number | null;
          min_rental_hours?: number | null;
          provider_actor_id: string;
          rental_price_per_day_btc?: number | null;
          rental_price_per_hour_btc?: number | null;
          updated_at?: string | null;
        };
        Update: {
          asset_id?: string;
          available_from?: string;
          available_to?: string | null;
          blocked_dates?: Json | null;
          created_at?: string | null;
          id?: string;
          is_available?: boolean | null;
          max_rental_hours?: number | null;
          min_rental_hours?: number | null;
          provider_actor_id?: string;
          rental_price_per_day_btc?: number | null;
          rental_price_per_hour_btc?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'asset_availability_asset_id_fkey';
            columns: ['asset_id'];
            referencedRelation: 'assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'asset_availability_provider_actor_id_fkey';
            columns: ['provider_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      assets: {
        Row: {
          actor_id: string | null;
          created_at: string;
          currency: string;
          deposit_amount_btc: number | null;
          description: string | null;
          documents: Json | null;
          estimated_value: number | null;
          id: string;
          is_for_rent: boolean;
          is_for_sale: boolean;
          is_test: boolean;
          location: string | null;
          max_rental_period: number | null;
          min_rental_period: number;
          owner_id: string;
          public_visibility: boolean;
          rental_period_type: string;
          rental_price_btc: number | null;
          requires_deposit: boolean;
          sale_price_btc: number | null;
          show_on_profile: boolean;
          status: string;
          title: string;
          type: string;
          updated_at: string;
          verification_status: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          currency?: string;
          deposit_amount_btc?: number | null;
          description?: string | null;
          documents?: Json | null;
          estimated_value?: number | null;
          id?: string;
          is_for_rent?: boolean;
          is_for_sale?: boolean;
          is_test?: boolean;
          location?: string | null;
          max_rental_period?: number | null;
          min_rental_period?: number;
          owner_id: string;
          public_visibility?: boolean;
          rental_period_type?: string;
          rental_price_btc?: number | null;
          requires_deposit?: boolean;
          sale_price_btc?: number | null;
          show_on_profile?: boolean;
          status?: string;
          title: string;
          type: string;
          updated_at?: string;
          verification_status?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          currency?: string;
          deposit_amount_btc?: number | null;
          description?: string | null;
          documents?: Json | null;
          estimated_value?: number | null;
          id?: string;
          is_for_rent?: boolean;
          is_for_sale?: boolean;
          is_test?: boolean;
          location?: string | null;
          max_rental_period?: number | null;
          min_rental_period?: number;
          owner_id?: string;
          public_visibility?: boolean;
          rental_period_type?: string;
          rental_price_btc?: number | null;
          requires_deposit?: boolean;
          sale_price_btc?: number | null;
          show_on_profile?: boolean;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
          verification_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assets_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          error_message: string | null;
          id: string;
          ip_address: string | null;
          metadata: Json | null;
          success: boolean | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          success?: boolean | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          error_message?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          success?: boolean | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      availability_slots: {
        Row: {
          created_at: string | null;
          current_bookings: number | null;
          day_of_week: number | null;
          end_time: string;
          id: string;
          is_available: boolean | null;
          max_bookings: number | null;
          provider_actor_id: string;
          service_id: string;
          specific_date: string | null;
          start_time: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_bookings?: number | null;
          day_of_week?: number | null;
          end_time: string;
          id?: string;
          is_available?: boolean | null;
          max_bookings?: number | null;
          provider_actor_id: string;
          service_id: string;
          specific_date?: string | null;
          start_time: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_bookings?: number | null;
          day_of_week?: number | null;
          end_time?: string;
          id?: string;
          is_available?: boolean | null;
          max_bookings?: number | null;
          provider_actor_id?: string;
          service_id?: string;
          specific_date?: string | null;
          start_time?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'availability_slots_provider_actor_id_fkey';
            columns: ['provider_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'availability_slots_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'user_services';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          bookable_id: string;
          bookable_type: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string | null;
          currency: string | null;
          customer_actor_id: string;
          customer_notes: string | null;
          customer_user_id: string;
          deposit_btc: number | null;
          deposit_paid: boolean | null;
          duration_minutes: number | null;
          ends_at: string;
          id: string;
          metadata: Json | null;
          price_btc: number;
          provider_actor_id: string;
          provider_notes: string | null;
          starts_at: string;
          status: string | null;
          timezone: string | null;
          total_paid_btc: number | null;
          updated_at: string | null;
        };
        Insert: {
          bookable_id: string;
          bookable_type: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_actor_id: string;
          customer_notes?: string | null;
          customer_user_id: string;
          deposit_btc?: number | null;
          deposit_paid?: boolean | null;
          duration_minutes?: number | null;
          ends_at: string;
          id?: string;
          metadata?: Json | null;
          price_btc?: number;
          provider_actor_id: string;
          provider_notes?: string | null;
          starts_at: string;
          status?: string | null;
          timezone?: string | null;
          total_paid_btc?: number | null;
          updated_at?: string | null;
        };
        Update: {
          bookable_id?: string;
          bookable_type?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_actor_id?: string;
          customer_notes?: string | null;
          customer_user_id?: string;
          deposit_btc?: number | null;
          deposit_paid?: boolean | null;
          duration_minutes?: number | null;
          ends_at?: string;
          id?: string;
          metadata?: Json | null;
          price_btc?: number;
          provider_actor_id?: string;
          provider_notes?: string | null;
          starts_at?: string;
          status?: string | null;
          timezone?: string | null;
          total_paid_btc?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_customer_actor_id_fkey';
            columns: ['customer_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_provider_actor_id_fkey';
            columns: ['provider_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      cat_action_log: {
        Row: {
          action_id: string;
          amount_btc: number | null;
          category: Database['public']['Enums']['cat_action_category'];
          completed_at: string | null;
          confirmed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          parameters: Json;
          requested_at: string;
          result: Json | null;
          started_at: string | null;
          status: Database['public']['Enums']['cat_action_status'];
          user_id: string;
        };
        Insert: {
          action_id: string;
          amount_btc?: number | null;
          category: Database['public']['Enums']['cat_action_category'];
          completed_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          parameters?: Json;
          requested_at?: string;
          result?: Json | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['cat_action_status'];
          user_id: string;
        };
        Update: {
          action_id?: string;
          amount_btc?: number | null;
          category?: Database['public']['Enums']['cat_action_category'];
          completed_at?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          parameters?: Json;
          requested_at?: string;
          result?: Json | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['cat_action_status'];
          user_id?: string;
        };
        Relationships: [];
      };
      cat_conversations: {
        Row: {
          created_at: string;
          id: string;
          is_default: boolean;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_credit_entries: {
        Row: {
          amount_btc: number;
          balance_after_btc: number;
          created_at: string;
          id: string;
          kind: string;
          metadata: Json | null;
          ref: string | null;
          seq: number;
          user_id: string;
        };
        Insert: {
          amount_btc: number;
          balance_after_btc: number;
          created_at?: string;
          id?: string;
          kind: string;
          metadata?: Json | null;
          ref?: string | null;
          seq?: never;
          user_id: string;
        };
        Update: {
          amount_btc?: number;
          balance_after_btc?: number;
          created_at?: string;
          id?: string;
          kind?: string;
          metadata?: Json | null;
          ref?: string | null;
          seq?: never;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_credit_topups: {
        Row: {
          amount_btc: number;
          bolt11: string;
          created_at: string;
          expires_at: string;
          id: string;
          paid_at: string | null;
          payment_hash: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_btc: number;
          bolt11: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          paid_at?: string | null;
          payment_hash: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_btc?: number;
          bolt11?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          paid_at?: string | null;
          payment_hash?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_forgotten_facts: {
        Row: {
          content: string;
          created_at: string;
          embedding: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_interests: {
        Row: {
          created_at: string;
          embedding: string | null;
          id: string;
          normalized: string;
          source: string;
          topic: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          embedding?: string | null;
          id?: string;
          normalized: string;
          source?: string;
          topic: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          embedding?: string | null;
          id?: string;
          normalized?: string;
          source?: string;
          topic?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_memories: {
        Row: {
          content: string;
          created_at: string;
          embedding: string | null;
          id: string;
          source: string;
          source_conversation_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          source?: string;
          source_conversation_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          source?: string;
          source_conversation_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cat_memories_source_conversation_id_fkey';
            columns: ['source_conversation_id'];
            referencedRelation: 'cat_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      cat_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          model_used: string | null;
          provider: string | null;
          role: string;
          token_count: number | null;
          user_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          model_used?: string | null;
          provider?: string | null;
          role: string;
          token_count?: number | null;
          user_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          model_used?: string | null;
          provider?: string | null;
          role?: string;
          token_count?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cat_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'cat_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      cat_pending_actions: {
        Row: {
          action_id: string;
          category: Database['public']['Enums']['cat_action_category'];
          confirmed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          description: string;
          expires_at: string;
          id: string;
          message_id: string | null;
          parameters: Json;
          rejected_at: string | null;
          rejection_reason: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          action_id: string;
          category: Database['public']['Enums']['cat_action_category'];
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          description: string;
          expires_at?: string;
          id?: string;
          message_id?: string | null;
          parameters?: Json;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          action_id?: string;
          category?: Database['public']['Enums']['cat_action_category'];
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          description?: string;
          expires_at?: string;
          id?: string;
          message_id?: string | null;
          parameters?: Json;
          rejected_at?: string | null;
          rejection_reason?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_permissions: {
        Row: {
          action_id: string;
          category: Database['public']['Enums']['cat_action_category'];
          created_at: string;
          daily_limit: number | null;
          granted: boolean;
          id: string;
          max_btc_per_action: number | null;
          max_btc_per_day: number | null;
          requires_confirmation: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action_id: string;
          category: Database['public']['Enums']['cat_action_category'];
          created_at?: string;
          daily_limit?: number | null;
          granted?: boolean;
          id?: string;
          max_btc_per_action?: number | null;
          max_btc_per_day?: number | null;
          requires_confirmation?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          action_id?: string;
          category?: Database['public']['Enums']['cat_action_category'];
          created_at?: string;
          daily_limit?: number | null;
          granted?: boolean;
          id?: string;
          max_btc_per_action?: number | null;
          max_btc_per_day?: number | null;
          requires_confirmation?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      cat_watches: {
        Row: {
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          fired_at: string | null;
          id: string;
          kind: string;
          label: string;
          status: string;
          target_btc: number | null;
          topic: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          fired_at?: string | null;
          id?: string;
          kind: string;
          label: string;
          status?: string;
          target_btc?: number | null;
          topic?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          fired_at?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          status?: string;
          target_btc?: number | null;
          topic?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      channel_waitlist: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          referrer: string | null;
          source: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          referrer?: string | null;
          source?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          referrer?: string | null;
          source?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      circles: {
        Row: {
          actor_id: string;
          category: string | null;
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_test: boolean;
          member_count: number;
          status: string;
          tags: string[] | null;
          title: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          actor_id: string;
          category?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_test?: boolean;
          member_count?: number;
          status?: string;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          actor_id?: string;
          category?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_test?: boolean;
          member_count?: number;
          status?: string;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'circles_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      content_embeddings: {
        Row: {
          embedding: string | null;
          entity_id: string;
          entity_type: string;
          quality_score: number;
          text_preview: string | null;
          title: string | null;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          embedding?: string | null;
          entity_id: string;
          entity_type: string;
          quality_score?: number;
          text_preview?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          embedding?: string | null;
          entity_id?: string;
          entity_type?: string;
          quality_score?: number;
          text_preview?: string | null;
          title?: string | null;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          activated_at: string | null;
          completed_at: string | null;
          contract_type: string;
          created_at: string | null;
          created_by: string | null;
          id: string;
          party_a_actor_id: string;
          party_b_actor_id: string;
          proposal_id: string | null;
          status: string;
          terminated_at: string | null;
          terms: Json;
          updated_at: string | null;
        };
        Insert: {
          activated_at?: string | null;
          completed_at?: string | null;
          contract_type: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          party_a_actor_id: string;
          party_b_actor_id: string;
          proposal_id?: string | null;
          status?: string;
          terminated_at?: string | null;
          terms?: Json;
          updated_at?: string | null;
        };
        Update: {
          activated_at?: string | null;
          completed_at?: string | null;
          contract_type?: string;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          party_a_actor_id?: string;
          party_b_actor_id?: string;
          proposal_id?: string | null;
          status?: string;
          terminated_at?: string | null;
          terms?: Json;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contracts_party_a_actor_id_fkey';
            columns: ['party_a_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_party_b_actor_id_fkey';
            columns: ['party_b_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contracts_proposal_id_fkey';
            columns: ['proposal_id'];
            referencedRelation: 'group_proposals';
            referencedColumns: ['id'];
          },
        ];
      };
      contributions: {
        Row: {
          amount_btc: number;
          contributor_id: string | null;
          created_at: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          is_anonymous: boolean | null;
          message: string | null;
          payment_intent_id: string;
        };
        Insert: {
          amount_btc: number;
          contributor_id?: string | null;
          created_at?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          is_anonymous?: boolean | null;
          message?: string | null;
          payment_intent_id: string;
        };
        Update: {
          amount_btc?: number;
          contributor_id?: string | null;
          created_at?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          is_anonymous?: boolean | null;
          message?: string | null;
          payment_intent_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contributions_payment_intent_id_fkey';
            columns: ['payment_intent_id'];
            referencedRelation: 'payment_intents';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          id: string;
          is_active: boolean;
          joined_at: string;
          last_read_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          id?: string;
          is_active?: boolean;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversation_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          conversation_type: string | null;
          created_at: string;
          created_by: string;
          id: string;
          is_group: boolean;
          last_message_at: string;
          last_message_preview: string | null;
          last_message_sender_id: string | null;
          professional_slug: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          conversation_type?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          professional_slug?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          conversation_type?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          professional_slug?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_last_message_sender_id_fkey';
            columns: ['last_message_sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      entity_wallets: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          is_primary: boolean | null;
          visibility: string;
          wallet_id: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          is_primary?: boolean | null;
          visibility?: string;
          wallet_id: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          is_primary?: boolean | null;
          visibility?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'entity_wallets_wallet_id_fkey';
            columns: ['wallet_id'];
            referencedRelation: 'wallets';
            referencedColumns: ['id'];
          },
        ];
      };
      event_attendees: {
        Row: {
          checked_in_at: string | null;
          event_id: string;
          id: string;
          payment_status: string | null;
          registered_at: string | null;
          status: string | null;
          ticket_count: number | null;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          checked_in_at?: string | null;
          event_id: string;
          id?: string;
          payment_status?: string | null;
          registered_at?: string | null;
          status?: string | null;
          ticket_count?: number | null;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          checked_in_at?: string | null;
          event_id?: string;
          id?: string;
          payment_status?: string | null;
          registered_at?: string | null;
          status?: string | null;
          ticket_count?: number | null;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_attendees_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          actor_id: string;
          asset_id: string | null;
          banner_url: string | null;
          bitcoin_address: string | null;
          category: string | null;
          created_at: string | null;
          currency: string | null;
          current_attendees: number | null;
          description: string | null;
          end_date: string | null;
          event_type: string | null;
          funding_goal: number | null;
          id: string;
          images: string[] | null;
          is_all_day: boolean | null;
          is_free: boolean | null;
          is_online: boolean | null;
          is_recurring: boolean | null;
          is_test: boolean;
          latitude: number | null;
          lightning_address: string | null;
          longitude: number | null;
          max_attendees: number | null;
          online_url: string | null;
          recurrence_pattern: Json | null;
          requires_rsvp: boolean | null;
          rsvp_deadline: string | null;
          show_on_profile: boolean | null;
          start_date: string;
          status: string | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          ticket_price: number | null;
          timezone: string | null;
          title: string;
          updated_at: string | null;
          user_id: string;
          venue_address: string | null;
          venue_city: string | null;
          venue_country: string | null;
          venue_name: string | null;
          venue_postal_code: string | null;
          video_url: string | null;
        };
        Insert: {
          actor_id: string;
          asset_id?: string | null;
          banner_url?: string | null;
          bitcoin_address?: string | null;
          category?: string | null;
          created_at?: string | null;
          currency?: string | null;
          current_attendees?: number | null;
          description?: string | null;
          end_date?: string | null;
          event_type?: string | null;
          funding_goal?: number | null;
          id?: string;
          images?: string[] | null;
          is_all_day?: boolean | null;
          is_free?: boolean | null;
          is_online?: boolean | null;
          is_recurring?: boolean | null;
          is_test?: boolean;
          latitude?: number | null;
          lightning_address?: string | null;
          longitude?: number | null;
          max_attendees?: number | null;
          online_url?: string | null;
          recurrence_pattern?: Json | null;
          requires_rsvp?: boolean | null;
          rsvp_deadline?: string | null;
          show_on_profile?: boolean | null;
          start_date: string;
          status?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          ticket_price?: number | null;
          timezone?: string | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
          venue_address?: string | null;
          venue_city?: string | null;
          venue_country?: string | null;
          venue_name?: string | null;
          venue_postal_code?: string | null;
          video_url?: string | null;
        };
        Update: {
          actor_id?: string;
          asset_id?: string | null;
          banner_url?: string | null;
          bitcoin_address?: string | null;
          category?: string | null;
          created_at?: string | null;
          currency?: string | null;
          current_attendees?: number | null;
          description?: string | null;
          end_date?: string | null;
          event_type?: string | null;
          funding_goal?: number | null;
          id?: string;
          images?: string[] | null;
          is_all_day?: boolean | null;
          is_free?: boolean | null;
          is_online?: boolean | null;
          is_recurring?: boolean | null;
          is_test?: boolean;
          latitude?: number | null;
          lightning_address?: string | null;
          longitude?: number | null;
          max_attendees?: number | null;
          online_url?: string | null;
          recurrence_pattern?: Json | null;
          requires_rsvp?: boolean | null;
          rsvp_deadline?: string | null;
          show_on_profile?: boolean | null;
          start_date?: string;
          status?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          ticket_price?: number | null;
          timezone?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
          venue_address?: string | null;
          venue_city?: string | null;
          venue_country?: string | null;
          venue_name?: string | null;
          venue_postal_code?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          follower_id: string;
          following_id: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          follower_id: string;
          following_id: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          follower_id?: string;
          following_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_following_id_fkey';
            columns: ['following_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      github_repo_cache: {
        Row: {
          fetched_at: string;
          handle: string;
          repos: Json;
          user_id: string;
        };
        Insert: {
          fetched_at?: string;
          handle: string;
          repos?: Json;
          user_id: string;
        };
        Update: {
          fetched_at?: string;
          handle?: string;
          repos?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      group_activities: {
        Row: {
          activity_type: string;
          created_at: string | null;
          group_id: string;
          id: string;
          metadata: Json | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          activity_type: string;
          created_at?: string | null;
          group_id: string;
          id?: string;
          metadata?: Json | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          activity_type?: string;
          created_at?: string | null;
          group_id?: string;
          id?: string;
          metadata?: Json | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_activities_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_event_rsvps: {
        Row: {
          created_at: string | null;
          event_id: string;
          id: string;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_id: string;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          event_id?: string;
          id?: string;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_event_rsvps_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'group_events';
            referencedColumns: ['id'];
          },
        ];
      };
      group_events: {
        Row: {
          created_at: string | null;
          creator_id: string;
          description: string | null;
          ends_at: string | null;
          event_type: string | null;
          group_id: string;
          id: string;
          is_public: boolean | null;
          location_details: string | null;
          location_type: string | null;
          max_attendees: number | null;
          requires_rsvp: boolean | null;
          starts_at: string;
          timezone: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          creator_id: string;
          description?: string | null;
          ends_at?: string | null;
          event_type?: string | null;
          group_id: string;
          id?: string;
          is_public?: boolean | null;
          location_details?: string | null;
          location_type?: string | null;
          max_attendees?: number | null;
          requires_rsvp?: boolean | null;
          starts_at: string;
          timezone?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          creator_id?: string;
          description?: string | null;
          ends_at?: string | null;
          event_type?: string | null;
          group_id?: string;
          id?: string;
          is_public?: boolean | null;
          location_details?: string | null;
          location_type?: string | null;
          max_attendees?: number | null;
          requires_rsvp?: boolean | null;
          starts_at?: string;
          timezone?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_events_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_features: {
        Row: {
          config: Json | null;
          enabled: boolean | null;
          enabled_at: string | null;
          enabled_by: string | null;
          feature_key: string;
          group_id: string;
          id: string;
        };
        Insert: {
          config?: Json | null;
          enabled?: boolean | null;
          enabled_at?: string | null;
          enabled_by?: string | null;
          feature_key: string;
          group_id: string;
          id?: string;
        };
        Update: {
          config?: Json | null;
          enabled?: boolean | null;
          enabled_at?: string | null;
          enabled_by?: string | null;
          feature_key?: string;
          group_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_features_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_invitations: {
        Row: {
          created_at: string | null;
          email: string | null;
          expires_at: string | null;
          group_id: string;
          id: string;
          invited_by: string;
          message: string | null;
          responded_at: string | null;
          role: string;
          status: string;
          token: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          group_id: string;
          id?: string;
          invited_by: string;
          message?: string | null;
          responded_at?: string | null;
          role?: string;
          status?: string;
          token?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          group_id?: string;
          id?: string;
          invited_by?: string;
          message?: string | null;
          responded_at?: string | null;
          role?: string;
          status?: string;
          token?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_invitations_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          permission_overrides: Json | null;
          role: string;
          user_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          permission_overrides?: Json | null;
          role?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          permission_overrides?: Json | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_proposals: {
        Row: {
          action_data: Json | null;
          action_type: string | null;
          created_at: string | null;
          description: string | null;
          executed_at: string | null;
          execution_result: Json | null;
          group_id: string;
          id: string;
          is_public: boolean;
          proposal_type: string;
          proposer_id: string;
          status: string;
          title: string;
          updated_at: string | null;
          voting_ends_at: string | null;
          voting_starts_at: string | null;
          voting_threshold: number | null;
        };
        Insert: {
          action_data?: Json | null;
          action_type?: string | null;
          created_at?: string | null;
          description?: string | null;
          executed_at?: string | null;
          execution_result?: Json | null;
          group_id: string;
          id?: string;
          is_public?: boolean;
          proposal_type?: string;
          proposer_id: string;
          status?: string;
          title: string;
          updated_at?: string | null;
          voting_ends_at?: string | null;
          voting_starts_at?: string | null;
          voting_threshold?: number | null;
        };
        Update: {
          action_data?: Json | null;
          action_type?: string | null;
          created_at?: string | null;
          description?: string | null;
          executed_at?: string | null;
          execution_result?: Json | null;
          group_id?: string;
          id?: string;
          is_public?: boolean;
          proposal_type?: string;
          proposer_id?: string;
          status?: string;
          title?: string;
          updated_at?: string | null;
          voting_ends_at?: string | null;
          voting_starts_at?: string | null;
          voting_threshold?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_proposals_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_proposals_proposer_id_fkey';
            columns: ['proposer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_votes: {
        Row: {
          id: string;
          proposal_id: string;
          vote: string;
          voted_at: string | null;
          voter_id: string;
          voting_power: number | null;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          vote: string;
          voted_at?: string | null;
          voter_id: string;
          voting_power?: number | null;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          vote?: string;
          voted_at?: string | null;
          voter_id?: string;
          voting_power?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_votes_proposal_id_fkey';
            columns: ['proposal_id'];
            referencedRelation: 'group_proposals';
            referencedColumns: ['id'];
          },
        ];
      };
      group_wallets: {
        Row: {
          bitcoin_address: string | null;
          created_at: string | null;
          created_by: string | null;
          current_balance_btc: number | null;
          description: string | null;
          group_id: string;
          id: string;
          is_active: boolean | null;
          lightning_address: string | null;
          name: string;
          purpose: string | null;
          required_signatures: number | null;
          updated_at: string | null;
        };
        Insert: {
          bitcoin_address?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          current_balance_btc?: number | null;
          description?: string | null;
          group_id: string;
          id?: string;
          is_active?: boolean | null;
          lightning_address?: string | null;
          name: string;
          purpose?: string | null;
          required_signatures?: number | null;
          updated_at?: string | null;
        };
        Update: {
          bitcoin_address?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          current_balance_btc?: number | null;
          description?: string | null;
          group_id?: string;
          id?: string;
          is_active?: boolean | null;
          lightning_address?: string | null;
          name?: string;
          purpose?: string | null;
          required_signatures?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_wallets_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          avatar_url: string | null;
          banner_url: string | null;
          bitcoin_address: string | null;
          created_at: string | null;
          created_by: string;
          description: string | null;
          governance_preset: string | null;
          id: string;
          is_public: boolean | null;
          label: string;
          lightning_address: string | null;
          name: string;
          slug: string;
          tags: string[] | null;
          updated_at: string | null;
          visibility: string | null;
          voting_threshold: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          banner_url?: string | null;
          bitcoin_address?: string | null;
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          governance_preset?: string | null;
          id?: string;
          is_public?: boolean | null;
          label?: string;
          lightning_address?: string | null;
          name: string;
          slug: string;
          tags?: string[] | null;
          updated_at?: string | null;
          visibility?: string | null;
          voting_threshold?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          banner_url?: string | null;
          bitcoin_address?: string | null;
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          governance_preset?: string | null;
          id?: string;
          is_public?: boolean | null;
          label?: string;
          lightning_address?: string | null;
          name?: string;
          slug?: string;
          tags?: string[] | null;
          updated_at?: string | null;
          visibility?: string | null;
          voting_threshold?: number | null;
        };
        Relationships: [];
      };
      idempotency_results: {
        Row: {
          body_hash: string;
          created_at: string;
          expires_at: string;
          id: string;
          key: string;
          method: string;
          path: string;
          response_body: Json | null;
          response_status: number | null;
          status: string;
          user_id: string;
        };
        Insert: {
          body_hash: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          key: string;
          method: string;
          path: string;
          response_body?: Json | null;
          response_status?: number | null;
          status?: string;
          user_id: string;
        };
        Update: {
          body_hash?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          key?: string;
          method?: string;
          path?: string;
          response_body?: Json | null;
          response_status?: number | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      integration_keys: {
        Row: {
          actor_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          is_test: boolean;
          key_hash: string;
          key_prefix: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          scopes: string[];
          user_id: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_test?: boolean;
          key_hash: string;
          key_prefix: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          scopes?: string[];
          user_id: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_test?: boolean;
          key_hash?: string;
          key_prefix?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          scopes?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'integration_keys_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      investments: {
        Row: {
          actor_id: string;
          bitcoin_address: string | null;
          created_at: string;
          currency: string;
          description: string | null;
          end_date: string | null;
          expected_return_rate: number | null;
          id: string;
          investment_type: string;
          is_public: boolean;
          is_test: boolean;
          lightning_address: string | null;
          maximum_investment: number | null;
          minimum_investment: number;
          return_frequency: string | null;
          risk_level: string | null;
          show_on_profile: boolean | null;
          start_date: string | null;
          status: string;
          target_amount: number;
          term_months: number | null;
          terms: string | null;
          thumbnail_url: string | null;
          title: string;
          total_raised: number;
          updated_at: string;
          wallet_id: string | null;
        };
        Insert: {
          actor_id: string;
          bitcoin_address?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          end_date?: string | null;
          expected_return_rate?: number | null;
          id?: string;
          investment_type?: string;
          is_public?: boolean;
          is_test?: boolean;
          lightning_address?: string | null;
          maximum_investment?: number | null;
          minimum_investment?: number;
          return_frequency?: string | null;
          risk_level?: string | null;
          show_on_profile?: boolean | null;
          start_date?: string | null;
          status?: string;
          target_amount: number;
          term_months?: number | null;
          terms?: string | null;
          thumbnail_url?: string | null;
          title: string;
          total_raised?: number;
          updated_at?: string;
          wallet_id?: string | null;
        };
        Update: {
          actor_id?: string;
          bitcoin_address?: string | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          end_date?: string | null;
          expected_return_rate?: number | null;
          id?: string;
          investment_type?: string;
          is_public?: boolean;
          is_test?: boolean;
          lightning_address?: string | null;
          maximum_investment?: number | null;
          minimum_investment?: number;
          return_frequency?: string | null;
          risk_level?: string | null;
          show_on_profile?: boolean | null;
          start_date?: string | null;
          status?: string;
          target_amount?: number;
          term_months?: number | null;
          terms?: string | null;
          thumbnail_url?: string | null;
          title?: string;
          total_raised?: number;
          updated_at?: string;
          wallet_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'investments_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'investments_wallet_id_fkey';
            columns: ['wallet_id'];
            referencedRelation: 'wallets';
            referencedColumns: ['id'];
          },
        ];
      };
      loan_categories: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      loan_collateral: {
        Row: {
          asset_id: string;
          created_at: string | null;
          currency: string | null;
          id: string;
          loan_id: string;
          owner_id: string;
          pledged_value: number | null;
          status: string | null;
        };
        Insert: {
          asset_id: string;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          loan_id: string;
          owner_id: string;
          pledged_value?: number | null;
          status?: string | null;
        };
        Update: {
          asset_id?: string;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          loan_id?: string;
          owner_id?: string;
          pledged_value?: number | null;
          status?: string | null;
        };
        Relationships: [];
      };
      loan_offers: {
        Row: {
          accepted_at: string | null;
          conditions: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          interest_rate: number | null;
          is_binding: boolean | null;
          loan_id: string;
          monthly_payment: number | null;
          offer_amount: number;
          offer_type: string;
          offerer_id: string;
          rejected_at: string | null;
          status: string | null;
          term_months: number | null;
          terms: string | null;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          conditions?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          interest_rate?: number | null;
          is_binding?: boolean | null;
          loan_id: string;
          monthly_payment?: number | null;
          offer_amount: number;
          offer_type: string;
          offerer_id: string;
          rejected_at?: string | null;
          status?: string | null;
          term_months?: number | null;
          terms?: string | null;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          conditions?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          interest_rate?: number | null;
          is_binding?: boolean | null;
          loan_id?: string;
          monthly_payment?: number | null;
          offer_amount?: number;
          offer_type?: string;
          offerer_id?: string;
          rejected_at?: string | null;
          status?: string | null;
          term_months?: number | null;
          terms?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loan_offers_loan_id_fkey';
            columns: ['loan_id'];
            referencedRelation: 'loans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loan_offers_offerer_id_fkey';
            columns: ['offerer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      loan_payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string | null;
          id: string;
          loan_id: string;
          notes: string | null;
          offer_id: string | null;
          payer_id: string;
          payment_method: string | null;
          payment_type: string;
          processed_at: string | null;
          recipient_id: string;
          status: string | null;
          transaction_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string | null;
          id?: string;
          loan_id: string;
          notes?: string | null;
          offer_id?: string | null;
          payer_id: string;
          payment_method?: string | null;
          payment_type: string;
          processed_at?: string | null;
          recipient_id: string;
          status?: string | null;
          transaction_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string | null;
          id?: string;
          loan_id?: string;
          notes?: string | null;
          offer_id?: string | null;
          payer_id?: string;
          payment_method?: string | null;
          payment_type?: string;
          processed_at?: string | null;
          recipient_id?: string;
          status?: string | null;
          transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'loan_payments_loan_id_fkey';
            columns: ['loan_id'];
            referencedRelation: 'loans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loan_payments_offer_id_fkey';
            columns: ['offer_id'];
            referencedRelation: 'loan_offers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loan_payments_payer_id_fkey';
            columns: ['payer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loan_payments_recipient_id_fkey';
            columns: ['recipient_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      loans: {
        Row: {
          actor_id: string;
          amount: number;
          bitcoin_address: string | null;
          contact_method: string | null;
          created_at: string;
          currency: string | null;
          current_interest_rate: number | null;
          current_lender: string | null;
          description: string | null;
          desired_rate: number | null;
          fulfillment_type: string | null;
          id: string;
          interest_rate: number | null;
          is_negotiable: boolean | null;
          is_public: boolean | null;
          is_test: boolean;
          lender_name: string | null;
          lightning_address: string | null;
          loan_category_id: string | null;
          loan_number: string | null;
          loan_type: string | null;
          maturity_date: string | null;
          minimum_offer_amount: number | null;
          monthly_payment: number | null;
          original_amount: number;
          origination_date: string | null;
          paid_off_at: string | null;
          preferred_terms: string | null;
          remaining_balance: number;
          show_on_profile: boolean | null;
          status: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          amount?: number;
          bitcoin_address?: string | null;
          contact_method?: string | null;
          created_at?: string;
          currency?: string | null;
          current_interest_rate?: number | null;
          current_lender?: string | null;
          description?: string | null;
          desired_rate?: number | null;
          fulfillment_type?: string | null;
          id?: string;
          interest_rate?: number | null;
          is_negotiable?: boolean | null;
          is_public?: boolean | null;
          is_test?: boolean;
          lender_name?: string | null;
          lightning_address?: string | null;
          loan_category_id?: string | null;
          loan_number?: string | null;
          loan_type?: string | null;
          maturity_date?: string | null;
          minimum_offer_amount?: number | null;
          monthly_payment?: number | null;
          original_amount: number;
          origination_date?: string | null;
          paid_off_at?: string | null;
          preferred_terms?: string | null;
          remaining_balance: number;
          show_on_profile?: boolean | null;
          status?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          amount?: number;
          bitcoin_address?: string | null;
          contact_method?: string | null;
          created_at?: string;
          currency?: string | null;
          current_interest_rate?: number | null;
          current_lender?: string | null;
          description?: string | null;
          desired_rate?: number | null;
          fulfillment_type?: string | null;
          id?: string;
          interest_rate?: number | null;
          is_negotiable?: boolean | null;
          is_public?: boolean | null;
          is_test?: boolean;
          lender_name?: string | null;
          lightning_address?: string | null;
          loan_category_id?: string | null;
          loan_number?: string | null;
          loan_type?: string | null;
          maturity_date?: string | null;
          minimum_offer_amount?: number | null;
          monthly_payment?: number | null;
          original_amount?: number;
          origination_date?: string | null;
          paid_off_at?: string | null;
          preferred_terms?: string | null;
          remaining_balance?: number;
          show_on_profile?: boolean | null;
          status?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loans_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loans_loan_category_id_fkey';
            columns: ['loan_category_id'];
            referencedRelation: 'loan_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loans_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      match_introductions: {
        Row: {
          created_at: string;
          demand_id: string;
          demand_type: string;
          id: string;
          supply_id: string;
          supply_type: string;
        };
        Insert: {
          created_at?: string;
          demand_id: string;
          demand_type: string;
          id?: string;
          supply_id: string;
          supply_type: string;
        };
        Update: {
          created_at?: string;
          demand_id?: string;
          demand_type?: string;
          id?: string;
          supply_id?: string;
          supply_type?: string;
        };
        Relationships: [];
      };
      message_read_receipts: {
        Row: {
          id: string;
          message_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_read_receipts_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'message_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_read_receipts_message_id_fkey';
            columns: ['message_id'];
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_read_receipts_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          edited_at: string | null;
          id: string;
          is_deleted: boolean;
          message_type: string;
          metadata: Json | null;
          sender_id: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          message_type?: string;
          metadata?: Json | null;
          sender_id: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          message_type?: string;
          metadata?: Json | null;
          sender_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversation_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_email_log: {
        Row: {
          email_address: string;
          id: string;
          metadata: Json | null;
          notification_type: string;
          resend_id: string | null;
          sent_at: string;
          status: string;
          subject: string;
          user_id: string;
        };
        Insert: {
          email_address: string;
          id?: string;
          metadata?: Json | null;
          notification_type: string;
          resend_id?: string | null;
          sent_at?: string;
          status?: string;
          subject: string;
          user_id: string;
        };
        Update: {
          email_address?: string;
          id?: string;
          metadata?: Json | null;
          notification_type?: string;
          resend_id?: string | null;
          sent_at?: string;
          status?: string;
          subject?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          digest_frequency: string;
          economic_emails: boolean;
          group_emails: boolean;
          id: string;
          progress_emails: boolean;
          reengagement_emails: boolean;
          social_emails: boolean;
          type_overrides: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          digest_frequency?: string;
          economic_emails?: boolean;
          group_emails?: boolean;
          id?: string;
          progress_emails?: boolean;
          reengagement_emails?: boolean;
          social_emails?: boolean;
          type_overrides?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          digest_frequency?: string;
          economic_emails?: boolean;
          group_emails?: boolean;
          id?: string;
          progress_emails?: boolean;
          reengagement_emails?: boolean;
          social_emails?: boolean;
          type_overrides?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_url: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          metadata: Json;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          action_url?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          metadata?: Json;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          action_url?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          metadata?: Json;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_auth_codes: {
        Row: {
          actor_id: string;
          client_id: string;
          code_challenge: string;
          code_challenge_method: string;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          nonce: string | null;
          redirect_uri: string;
          scopes: string[];
          user_id: string;
        };
        Insert: {
          actor_id: string;
          client_id: string;
          code_challenge: string;
          code_challenge_method?: string;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          nonce?: string | null;
          redirect_uri: string;
          scopes?: string[];
          user_id: string;
        };
        Update: {
          actor_id?: string;
          client_id?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          nonce?: string | null;
          redirect_uri?: string;
          scopes?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      oauth_clients: {
        Row: {
          allowed_scopes: string[];
          client_id: string;
          client_secret_hash: string | null;
          created_at: string;
          disabled_at: string | null;
          id: string;
          is_confidential: boolean;
          is_trusted: boolean;
          name: string;
          redirect_uris: string[];
        };
        Insert: {
          allowed_scopes?: string[];
          client_id: string;
          client_secret_hash?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          id?: string;
          is_confidential?: boolean;
          is_trusted?: boolean;
          name: string;
          redirect_uris?: string[];
        };
        Update: {
          allowed_scopes?: string[];
          client_id?: string;
          client_secret_hash?: string | null;
          created_at?: string;
          disabled_at?: string | null;
          id?: string;
          is_confidential?: boolean;
          is_trusted?: boolean;
          name?: string;
          redirect_uris?: string[];
        };
        Relationships: [];
      };
      oauth_refresh_tokens: {
        Row: {
          actor_id: string;
          client_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          revoked_at: string | null;
          scopes: string[];
          token_hash: string;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          client_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash: string;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          client_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      oauth_user_grants: {
        Row: {
          client_id: string;
          granted_at: string;
          id: string;
          scopes: string[];
          user_id: string;
        };
        Insert: {
          client_id: string;
          granted_at?: string;
          id?: string;
          scopes?: string[];
          user_id: string;
        };
        Update: {
          client_id?: string;
          granted_at?: string;
          id?: string;
          scopes?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          amount_btc: number;
          buyer_id: string;
          buyer_note: string | null;
          created_at: string | null;
          entity_id: string;
          entity_title: string;
          entity_type: string;
          id: string;
          payment_intent_id: string;
          seller_id: string;
          seller_note: string | null;
          shipping_address_id: string | null;
          status: string;
          tracking_number: string | null;
          tracking_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount_btc: number;
          buyer_id: string;
          buyer_note?: string | null;
          created_at?: string | null;
          entity_id: string;
          entity_title: string;
          entity_type: string;
          id?: string;
          payment_intent_id: string;
          seller_id: string;
          seller_note?: string | null;
          shipping_address_id?: string | null;
          status?: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount_btc?: number;
          buyer_id?: string;
          buyer_note?: string | null;
          created_at?: string | null;
          entity_id?: string;
          entity_title?: string;
          entity_type?: string;
          id?: string;
          payment_intent_id?: string;
          seller_id?: string;
          seller_note?: string | null;
          shipping_address_id?: string | null;
          status?: string;
          tracking_number?: string | null;
          tracking_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_payment_intent_id_fkey';
            columns: ['payment_intent_id'];
            referencedRelation: 'payment_intents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_shipping_address_id_fkey';
            columns: ['shipping_address_id'];
            referencedRelation: 'shipping_addresses';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_intents: {
        Row: {
          amount_btc: number;
          bolt11: string | null;
          buyer_id: string | null;
          created_at: string | null;
          description: string | null;
          entity_id: string | null;
          entity_type: string | null;
          expires_at: string | null;
          id: string;
          intent_kind: string;
          last_polled_at: string | null;
          lnurl_verify_url: string | null;
          onchain_address: string | null;
          paid_at: string | null;
          payment_hash: string | null;
          payment_method: string;
          public_status_token_hash: string | null;
          receiving_wallet_id: string | null;
          seller_id: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          amount_btc: number;
          bolt11?: string | null;
          buyer_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          intent_kind?: string;
          last_polled_at?: string | null;
          lnurl_verify_url?: string | null;
          onchain_address?: string | null;
          paid_at?: string | null;
          payment_hash?: string | null;
          payment_method: string;
          public_status_token_hash?: string | null;
          receiving_wallet_id?: string | null;
          seller_id: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          amount_btc?: number;
          bolt11?: string | null;
          buyer_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          expires_at?: string | null;
          id?: string;
          intent_kind?: string;
          last_polled_at?: string | null;
          lnurl_verify_url?: string | null;
          onchain_address?: string | null;
          paid_at?: string | null;
          payment_hash?: string | null;
          payment_method?: string;
          public_status_token_hash?: string | null;
          receiving_wallet_id?: string | null;
          seller_id?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payment_requests: {
        Row: {
          amount_btc: number;
          created_at: string;
          id: string;
          note: string | null;
          paid_at: string | null;
          paid_intent_id: string | null;
          payer_id: string;
          requester_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_btc: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          paid_intent_id?: string | null;
          payer_id: string;
          requester_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_btc?: number;
          created_at?: string;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          paid_intent_id?: string | null;
          payer_id?: string;
          requester_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_requests_paid_intent_id_fkey';
            columns: ['paid_intent_id'];
            referencedRelation: 'payment_intents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_requests_payer_id_fkey';
            columns: ['payer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_requests_requester_id_fkey';
            columns: ['requester_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_api_usage: {
        Row: {
          created_at: string;
          id: string;
          request_count: number;
          token_count: number;
          updated_at: string;
          usage_date: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          request_count?: number;
          token_count?: number;
          updated_at?: string;
          usage_date?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          request_count?: number;
          token_count?: number;
          updated_at?: string;
          usage_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      post_visibility: {
        Row: {
          added_at: string;
          added_by_id: string;
          created_at: string;
          id: string;
          post_id: string;
          timeline_owner_id: string | null;
          timeline_type: string;
        };
        Insert: {
          added_at?: string;
          added_by_id: string;
          created_at?: string;
          id?: string;
          post_id: string;
          timeline_owner_id?: string | null;
          timeline_type: string;
        };
        Update: {
          added_at?: string;
          added_by_id?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          timeline_owner_id?: string | null;
          timeline_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'post_visibility_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_visibility_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'post_visibility_post_id_fkey';
            columns: ['post_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          background: string | null;
          banner_url: string | null;
          bio: string | null;
          bitcoin_address: string | null;
          bitcoin_public_key: string | null;
          contact_email: string | null;
          created_at: string;
          currency: string | null;
          current_status: string | null;
          email: string | null;
          help_wanted: string[] | null;
          id: string;
          inspiration_statement: string | null;
          language: string | null;
          last_active_at: string | null;
          last_login_at: string | null;
          latitude: number | null;
          lightning_address: string | null;
          lightning_node_id: string | null;
          location: string | null;
          location_city: string | null;
          location_country: string | null;
          location_search: string | null;
          location_zip: string | null;
          longitude: number | null;
          metadata: Json | null;
          name: string | null;
          onboarding_completed: boolean | null;
          onboarding_first_project_created: boolean | null;
          onboarding_method: string | null;
          onboarding_wallet_setup_completed: boolean | null;
          payment_preferences: Json | null;
          phone: string | null;
          preferences: Json | null;
          privacy_policy_accepted_at: string | null;
          privacy_settings: Json | null;
          profile_completed_at: string | null;
          receive_reminders: boolean;
          social_links: Json | null;
          status: string | null;
          terms_accepted_at: string | null;
          timezone: string | null;
          updated_at: string;
          username: string;
          verification_data: Json | null;
          verification_status: string | null;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          background?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          bitcoin_address?: string | null;
          bitcoin_public_key?: string | null;
          contact_email?: string | null;
          created_at?: string;
          currency?: string | null;
          current_status?: string | null;
          email?: string | null;
          help_wanted?: string[] | null;
          id: string;
          inspiration_statement?: string | null;
          language?: string | null;
          last_active_at?: string | null;
          last_login_at?: string | null;
          latitude?: number | null;
          lightning_address?: string | null;
          lightning_node_id?: string | null;
          location?: string | null;
          location_city?: string | null;
          location_country?: string | null;
          location_search?: string | null;
          location_zip?: string | null;
          longitude?: number | null;
          metadata?: Json | null;
          name?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_first_project_created?: boolean | null;
          onboarding_method?: string | null;
          onboarding_wallet_setup_completed?: boolean | null;
          payment_preferences?: Json | null;
          phone?: string | null;
          preferences?: Json | null;
          privacy_policy_accepted_at?: string | null;
          privacy_settings?: Json | null;
          profile_completed_at?: string | null;
          receive_reminders?: boolean;
          social_links?: Json | null;
          status?: string | null;
          terms_accepted_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          username: string;
          verification_data?: Json | null;
          verification_status?: string | null;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          background?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          bitcoin_address?: string | null;
          bitcoin_public_key?: string | null;
          contact_email?: string | null;
          created_at?: string;
          currency?: string | null;
          current_status?: string | null;
          email?: string | null;
          help_wanted?: string[] | null;
          id?: string;
          inspiration_statement?: string | null;
          language?: string | null;
          last_active_at?: string | null;
          last_login_at?: string | null;
          latitude?: number | null;
          lightning_address?: string | null;
          lightning_node_id?: string | null;
          location?: string | null;
          location_city?: string | null;
          location_country?: string | null;
          location_search?: string | null;
          location_zip?: string | null;
          longitude?: number | null;
          metadata?: Json | null;
          name?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_first_project_created?: boolean | null;
          onboarding_method?: string | null;
          onboarding_wallet_setup_completed?: boolean | null;
          payment_preferences?: Json | null;
          phone?: string | null;
          preferences?: Json | null;
          privacy_policy_accepted_at?: string | null;
          privacy_settings?: Json | null;
          profile_completed_at?: string | null;
          receive_reminders?: boolean;
          social_links?: Json | null;
          status?: string | null;
          terms_accepted_at?: string | null;
          timezone?: string | null;
          updated_at?: string;
          username?: string;
          verification_data?: Json | null;
          verification_status?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      project_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      project_favorites: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_favorites_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_media: {
        Row: {
          alt_text: string | null;
          created_at: string;
          id: string;
          position: number;
          project_id: string;
          storage_path: string;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          project_id: string;
          storage_path: string;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string;
          id?: string;
          position?: number;
          project_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_media_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_roles: {
        Row: {
          created_at: string;
          description: string | null;
          engagement_type: string;
          id: string;
          project_id: string;
          role_title: string;
          skills: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          engagement_type?: string;
          id?: string;
          project_id: string;
          role_title: string;
          skills?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          engagement_type?: string;
          id?: string;
          project_id?: string;
          role_title?: string;
          skills?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_roles_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_support: {
        Row: {
          amount_btc: number | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_anonymous: boolean | null;
          lightning_invoice: string | null;
          message: string | null;
          project_id: string;
          reaction_emoji: string | null;
          support_type: Database['public']['Enums']['support_type'];
          transaction_hash: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          amount_btc?: number | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_anonymous?: boolean | null;
          lightning_invoice?: string | null;
          message?: string | null;
          project_id: string;
          reaction_emoji?: string | null;
          support_type: Database['public']['Enums']['support_type'];
          transaction_hash?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          amount_btc?: number | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_anonymous?: boolean | null;
          lightning_invoice?: string | null;
          message?: string | null;
          project_id?: string;
          reaction_emoji?: string | null;
          support_type?: Database['public']['Enums']['support_type'];
          transaction_hash?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'project_support_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_support_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_support_stats: {
        Row: {
          last_support_at: string | null;
          project_id: string;
          total_bitcoin_btc: number | null;
          total_messages: number | null;
          total_reactions: number | null;
          total_signatures: number | null;
          total_supporters: number | null;
          updated_at: string;
        };
        Insert: {
          last_support_at?: string | null;
          project_id: string;
          total_bitcoin_btc?: number | null;
          total_messages?: number | null;
          total_reactions?: number | null;
          total_signatures?: number | null;
          total_supporters?: number | null;
          updated_at?: string;
        };
        Update: {
          last_support_at?: string | null;
          project_id?: string;
          total_bitcoin_btc?: number | null;
          total_messages?: number | null;
          total_reactions?: number | null;
          total_signatures?: number | null;
          total_supporters?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_support_stats_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_updates: {
        Row: {
          amount_btc: number | null;
          content: string | null;
          created_at: string | null;
          id: string;
          project_id: string;
          title: string | null;
          type: string | null;
        };
        Insert: {
          amount_btc?: number | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          project_id: string;
          title?: string | null;
          type?: string | null;
        };
        Update: {
          amount_btc?: number | null;
          content?: string | null;
          created_at?: string | null;
          id?: string;
          project_id?: string;
          title?: string | null;
          type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'project_updates_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          actor_id: string;
          bitcoin_address: string | null;
          category: string | null;
          contributor_count: number | null;
          cover_image_url: string | null;
          created_at: string | null;
          creator_id: string | null;
          currency: string | null;
          description: string | null;
          funding_purpose: string | null;
          goal_amount: number | null;
          group_id: string | null;
          id: string;
          is_test: boolean;
          lightning_address: string | null;
          raised_amount: number | null;
          show_on_profile: boolean | null;
          status: string | null;
          tags: string[] | null;
          title: string | null;
          updated_at: string | null;
          user_id: string;
          website_url: string | null;
        };
        Insert: {
          actor_id: string;
          bitcoin_address?: string | null;
          category?: string | null;
          contributor_count?: number | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          creator_id?: string | null;
          currency?: string | null;
          description?: string | null;
          funding_purpose?: string | null;
          goal_amount?: number | null;
          group_id?: string | null;
          id?: string;
          is_test?: boolean;
          lightning_address?: string | null;
          raised_amount?: number | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          tags?: string[] | null;
          title?: string | null;
          updated_at?: string | null;
          user_id: string;
          website_url?: string | null;
        };
        Update: {
          actor_id?: string;
          bitcoin_address?: string | null;
          category?: string | null;
          contributor_count?: number | null;
          cover_image_url?: string | null;
          created_at?: string | null;
          creator_id?: string | null;
          currency?: string | null;
          description?: string | null;
          funding_purpose?: string | null;
          goal_amount?: number | null;
          group_id?: string | null;
          id?: string;
          is_test?: boolean;
          lightning_address?: string | null;
          raised_amount?: number | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          tags?: string[] | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      research_contributions: {
        Row: {
          amount_btc: number;
          anonymous: boolean | null;
          confirmed_at: string | null;
          created_at: string | null;
          funding_model: string;
          id: string;
          lightning_invoice: string | null;
          message: string | null;
          onchain_tx: string | null;
          research_entity_id: string;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          amount_btc: number;
          anonymous?: boolean | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          funding_model: string;
          id?: string;
          lightning_invoice?: string | null;
          message?: string | null;
          onchain_tx?: string | null;
          research_entity_id: string;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount_btc?: number;
          anonymous?: boolean | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          funding_model?: string;
          id?: string;
          lightning_invoice?: string | null;
          message?: string | null;
          onchain_tx?: string | null;
          research_entity_id?: string;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'research_contributions_research_entity_id_fkey';
            columns: ['research_entity_id'];
            referencedRelation: 'research_entities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_contributions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      research_entities: {
        Row: {
          actor_id: string;
          contributions: Json | null;
          created_at: string | null;
          current_milestone: string | null;
          description: string;
          expected_outcome: string;
          field: string;
          funding_goal_btc: number;
          funding_model: string;
          funding_raised_btc: number | null;
          id: string;
          impact_areas: Json | null;
          is_featured: boolean | null;
          is_public: boolean | null;
          lead_researcher: string;
          metadata: Json | null;
          methodology: string;
          next_deadline: string | null;
          open_collaboration: boolean | null;
          progress_frequency: string;
          progress_updates: Json | null;
          resource_needs: Json | null;
          sdg_alignment: Json | null;
          search_vector: unknown;
          show_on_profile: boolean | null;
          status: string | null;
          target_audience: string[] | null;
          team_members: Json | null;
          timeline: string;
          title: string;
          transparency_level: string;
          updated_at: string | null;
          user_id: string;
          voting_enabled: boolean | null;
          wallet_address: string;
        };
        Insert: {
          actor_id: string;
          contributions?: Json | null;
          created_at?: string | null;
          current_milestone?: string | null;
          description: string;
          expected_outcome: string;
          field: string;
          funding_goal_btc: number;
          funding_model: string;
          funding_raised_btc?: number | null;
          id?: string;
          impact_areas?: Json | null;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          lead_researcher: string;
          metadata?: Json | null;
          methodology: string;
          next_deadline?: string | null;
          open_collaboration?: boolean | null;
          progress_frequency: string;
          progress_updates?: Json | null;
          resource_needs?: Json | null;
          sdg_alignment?: Json | null;
          search_vector?: unknown;
          show_on_profile?: boolean | null;
          status?: string | null;
          target_audience?: string[] | null;
          team_members?: Json | null;
          timeline: string;
          title: string;
          transparency_level: string;
          updated_at?: string | null;
          user_id: string;
          voting_enabled?: boolean | null;
          wallet_address: string;
        };
        Update: {
          actor_id?: string;
          contributions?: Json | null;
          created_at?: string | null;
          current_milestone?: string | null;
          description?: string;
          expected_outcome?: string;
          field?: string;
          funding_goal_btc?: number;
          funding_model?: string;
          funding_raised_btc?: number | null;
          id?: string;
          impact_areas?: Json | null;
          is_featured?: boolean | null;
          is_public?: boolean | null;
          lead_researcher?: string;
          metadata?: Json | null;
          methodology?: string;
          next_deadline?: string | null;
          open_collaboration?: boolean | null;
          progress_frequency?: string;
          progress_updates?: Json | null;
          resource_needs?: Json | null;
          sdg_alignment?: Json | null;
          search_vector?: unknown;
          show_on_profile?: boolean | null;
          status?: string | null;
          target_audience?: string[] | null;
          team_members?: Json | null;
          timeline?: string;
          title?: string;
          transparency_level?: string;
          updated_at?: string | null;
          user_id?: string;
          voting_enabled?: boolean | null;
          wallet_address?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'research_entities_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_entities_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      research_progress_updates: {
        Row: {
          attachments: string[] | null;
          created_at: string | null;
          description: string;
          funding_released: number | null;
          id: string;
          milestone_achieved: boolean | null;
          research_entity_id: string;
          title: string;
          total_votes: number | null;
          user_id: string;
          votes_down: number | null;
          votes_up: number | null;
        };
        Insert: {
          attachments?: string[] | null;
          created_at?: string | null;
          description: string;
          funding_released?: number | null;
          id?: string;
          milestone_achieved?: boolean | null;
          research_entity_id: string;
          title: string;
          total_votes?: number | null;
          user_id: string;
          votes_down?: number | null;
          votes_up?: number | null;
        };
        Update: {
          attachments?: string[] | null;
          created_at?: string | null;
          description?: string;
          funding_released?: number | null;
          id?: string;
          milestone_achieved?: boolean | null;
          research_entity_id?: string;
          title?: string;
          total_votes?: number | null;
          user_id?: string;
          votes_down?: number | null;
          votes_up?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'research_progress_updates_research_entity_id_fkey';
            columns: ['research_entity_id'];
            referencedRelation: 'research_entities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_progress_updates_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      research_votes: {
        Row: {
          choice: string;
          created_at: string | null;
          id: string;
          research_entity_id: string;
          user_id: string;
          vote_type: string;
          weight: number | null;
        };
        Insert: {
          choice: string;
          created_at?: string | null;
          id?: string;
          research_entity_id: string;
          user_id: string;
          vote_type: string;
          weight?: number | null;
        };
        Update: {
          choice?: string;
          created_at?: string | null;
          id?: string;
          research_entity_id?: string;
          user_id?: string;
          vote_type?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'research_votes_research_entity_id_fkey';
            columns: ['research_entity_id'];
            referencedRelation: 'research_entities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'research_votes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      schema_migrations: {
        Row: {
          applied_at: string;
          filename: string;
        };
        Insert: {
          applied_at?: string;
          filename: string;
        };
        Update: {
          applied_at?: string;
          filename?: string;
        };
        Relationships: [];
      };
      search_queries: {
        Row: {
          created_at: string;
          id: number;
          query: string;
          result_count: number | null;
        };
        Insert: {
          created_at?: string;
          id?: never;
          query: string;
          result_count?: number | null;
        };
        Update: {
          created_at?: string;
          id?: never;
          query?: string;
          result_count?: number | null;
        };
        Relationships: [];
      };
      shipping_addresses: {
        Row: {
          city: string;
          country_code: string;
          created_at: string | null;
          full_name: string;
          id: string;
          is_default: boolean | null;
          label: string | null;
          postal_code: string;
          state: string | null;
          street: string;
          street2: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          city: string;
          country_code?: string;
          created_at?: string | null;
          full_name: string;
          id?: string;
          is_default?: boolean | null;
          label?: string | null;
          postal_code: string;
          state?: string | null;
          street: string;
          street2?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          city?: string;
          country_code?: string;
          created_at?: string | null;
          full_name?: string;
          id?: string;
          is_default?: boolean | null;
          label?: string | null;
          postal_code?: string;
          state?: string | null;
          street?: string;
          street2?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      solon_trusted_keys: {
        Row: {
          added_at: string;
          bitcoin_address: string;
          display_name: string;
          id: string;
          member_type: string;
          public_key_hex: string | null;
          revoked_at: string | null;
          solon_member_id: string;
          voting_weight: number;
        };
        Insert: {
          added_at?: string;
          bitcoin_address: string;
          display_name: string;
          id?: string;
          member_type: string;
          public_key_hex?: string | null;
          revoked_at?: string | null;
          solon_member_id: string;
          voting_weight?: number;
        };
        Update: {
          added_at?: string;
          bitcoin_address?: string;
          display_name?: string;
          id?: string;
          member_type?: string;
          public_key_hex?: string | null;
          revoked_at?: string | null;
          solon_member_id?: string;
          voting_weight?: number;
        };
        Relationships: [];
      };
      stakeholder_relationships: {
        Row: {
          confidence: number | null;
          created_at: string;
          from_project_id: string;
          id: string;
          kind: string;
          metadata: Json;
          notes: string | null;
          owner_actor_id: string;
          status: string | null;
          to_actor_id: string | null;
          to_external_name: string | null;
          to_external_url: string | null;
          to_project_id: string | null;
          updated_at: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          from_project_id: string;
          id?: string;
          kind: string;
          metadata?: Json;
          notes?: string | null;
          owner_actor_id: string;
          status?: string | null;
          to_actor_id?: string | null;
          to_external_name?: string | null;
          to_external_url?: string | null;
          to_project_id?: string | null;
          updated_at?: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          from_project_id?: string;
          id?: string;
          kind?: string;
          metadata?: Json;
          notes?: string | null;
          owner_actor_id?: string;
          status?: string | null;
          to_actor_id?: string | null;
          to_external_name?: string | null;
          to_external_url?: string | null;
          to_project_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stakeholder_relationships_from_project_id_fkey';
            columns: ['from_project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stakeholder_relationships_owner_actor_id_fkey';
            columns: ['owner_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stakeholder_relationships_to_actor_id_fkey';
            columns: ['to_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stakeholder_relationships_to_project_id_fkey';
            columns: ['to_project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      task_attention_flags: {
        Row: {
          created_at: string | null;
          flagged_by: string;
          id: string;
          is_resolved: boolean | null;
          message: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          resolved_by_completion_id: string | null;
          task_id: string;
        };
        Insert: {
          created_at?: string | null;
          flagged_by: string;
          id?: string;
          is_resolved?: boolean | null;
          message?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolved_by_completion_id?: string | null;
          task_id: string;
        };
        Update: {
          created_at?: string | null;
          flagged_by?: string;
          id?: string;
          is_resolved?: boolean | null;
          message?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          resolved_by_completion_id?: string | null;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_attention_flags_resolved_by_completion_id_fkey';
            columns: ['resolved_by_completion_id'];
            referencedRelation: 'task_completions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_attention_flags_task_id_fkey';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_completions: {
        Row: {
          completed_at: string | null;
          completed_by: string;
          created_at: string | null;
          duration_minutes: number | null;
          id: string;
          notes: string | null;
          task_id: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_by: string;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          task_id: string;
        };
        Update: {
          completed_at?: string | null;
          completed_by?: string;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_completions_task_id_fkey';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_projects: {
        Row: {
          created_at: string | null;
          created_by: string;
          description: string | null;
          id: string;
          status: string;
          target_date: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          id?: string;
          status?: string;
          target_date?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          id?: string;
          status?: string;
          target_date?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      task_requests: {
        Row: {
          completion_id: string | null;
          created_at: string | null;
          id: string;
          is_broadcast: boolean | null;
          message: string | null;
          requested_by: string;
          requested_user_id: string | null;
          responded_by: string | null;
          response_message: string | null;
          status: string;
          task_id: string;
          updated_at: string | null;
        };
        Insert: {
          completion_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_broadcast?: boolean | null;
          message?: string | null;
          requested_by: string;
          requested_user_id?: string | null;
          responded_by?: string | null;
          response_message?: string | null;
          status?: string;
          task_id: string;
          updated_at?: string | null;
        };
        Update: {
          completion_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_broadcast?: boolean | null;
          message?: string | null;
          requested_by?: string;
          requested_user_id?: string | null;
          responded_by?: string | null;
          response_message?: string | null;
          status?: string;
          task_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'task_requests_completion_id_fkey';
            columns: ['completion_id'];
            referencedRelation: 'task_completions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_requests_task_id_fkey';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          category: string;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string | null;
          created_by: string;
          current_status: string;
          description: string | null;
          due_date: string | null;
          estimated_minutes: number | null;
          id: string;
          instructions: string | null;
          is_archived: boolean | null;
          is_completed: boolean | null;
          is_reminder: boolean;
          priority: string;
          project_id: string | null;
          schedule_cron: string | null;
          schedule_human: string | null;
          tags: string[] | null;
          task_type: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          category: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string | null;
          created_by: string;
          current_status?: string;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          instructions?: string | null;
          is_archived?: boolean | null;
          is_completed?: boolean | null;
          is_reminder?: boolean;
          priority?: string;
          project_id?: string | null;
          schedule_cron?: string | null;
          schedule_human?: string | null;
          tags?: string[] | null;
          task_type: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          category?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string | null;
          created_by?: string;
          current_status?: string;
          description?: string | null;
          due_date?: string | null;
          estimated_minutes?: number | null;
          id?: string;
          instructions?: string | null;
          is_archived?: boolean | null;
          is_completed?: boolean | null;
          is_reminder?: boolean;
          priority?: string;
          project_id?: string | null;
          schedule_cron?: string | null;
          schedule_human?: string | null;
          tags?: string[] | null;
          task_type?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'task_projects';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_comments: {
        Row: {
          content: string;
          content_html: string | null;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          event_id: string;
          id: string;
          is_deleted: boolean | null;
          parent_comment_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          content_html?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          event_id: string;
          id?: string;
          is_deleted?: boolean | null;
          parent_comment_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          content_html?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          event_id?: string;
          id?: string;
          is_deleted?: boolean | null;
          parent_comment_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_comments_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_comments_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_comments_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_comments_parent_comment_id_fkey';
            columns: ['parent_comment_id'];
            referencedRelation: 'timeline_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_comments_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_dislikes: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_dislikes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_dislikes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_dislikes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_dislikes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_event_stats: {
        Row: {
          comment_count: number | null;
          dislike_count: number | null;
          event_id: string;
          like_count: number | null;
          share_count: number | null;
          updated_at: string | null;
          view_count: number | null;
        };
        Insert: {
          comment_count?: number | null;
          dislike_count?: number | null;
          event_id: string;
          like_count?: number | null;
          share_count?: number | null;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Update: {
          comment_count?: number | null;
          dislike_count?: number | null;
          event_id?: string;
          like_count?: number | null;
          share_count?: number | null;
          updated_at?: string | null;
          view_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_event_stats_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_event_stats_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_event_stats_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_event_visibility: {
        Row: {
          created_at: string | null;
          event_id: string;
          id: string;
          timeline_owner_id: string | null;
          timeline_type: string;
        };
        Insert: {
          created_at?: string | null;
          event_id: string;
          id?: string;
          timeline_owner_id?: string | null;
          timeline_type: string;
        };
        Update: {
          created_at?: string | null;
          event_id?: string;
          id?: string;
          timeline_owner_id?: string | null;
          timeline_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_event_visibility_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_event_visibility_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_event_visibility_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_events: {
        Row: {
          actor_id: string | null;
          actor_type: string | null;
          amount_btc: number | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          description: string | null;
          device_info: Json | null;
          event_subtype: string | null;
          event_timestamp: string;
          event_type: string;
          id: string;
          is_cross_post_duplicate: boolean | null;
          is_deleted: boolean | null;
          is_featured: boolean | null;
          is_quote_reply: boolean | null;
          location_data: Json | null;
          metadata: Json | null;
          parent_event_id: string | null;
          quantity: number | null;
          subject_id: string | null;
          subject_type: string;
          tags: string[] | null;
          target_id: string | null;
          target_type: string | null;
          thread_depth: number | null;
          thread_id: string | null;
          title: string;
          updated_at: string;
          visibility: string | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_type?: string | null;
          amount_btc?: number | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          device_info?: Json | null;
          event_subtype?: string | null;
          event_timestamp?: string;
          event_type: string;
          id?: string;
          is_cross_post_duplicate?: boolean | null;
          is_deleted?: boolean | null;
          is_featured?: boolean | null;
          is_quote_reply?: boolean | null;
          location_data?: Json | null;
          metadata?: Json | null;
          parent_event_id?: string | null;
          quantity?: number | null;
          subject_id?: string | null;
          subject_type: string;
          tags?: string[] | null;
          target_id?: string | null;
          target_type?: string | null;
          thread_depth?: number | null;
          thread_id?: string | null;
          title: string;
          updated_at?: string;
          visibility?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_type?: string | null;
          amount_btc?: number | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          description?: string | null;
          device_info?: Json | null;
          event_subtype?: string | null;
          event_timestamp?: string;
          event_type?: string;
          id?: string;
          is_cross_post_duplicate?: boolean | null;
          is_deleted?: boolean | null;
          is_featured?: boolean | null;
          is_quote_reply?: boolean | null;
          location_data?: Json | null;
          metadata?: Json | null;
          parent_event_id?: string | null;
          quantity?: number | null;
          subject_id?: string | null;
          subject_type?: string;
          tags?: string[] | null;
          target_id?: string | null;
          target_type?: string | null;
          thread_depth?: number | null;
          thread_id?: string | null;
          title?: string;
          updated_at?: string;
          visibility?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_events_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_interactions: {
        Row: {
          created_at: string | null;
          event_id: string;
          id: string;
          interaction_type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_id: string;
          id?: string;
          interaction_type: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          event_id?: string;
          id?: string;
          interaction_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_interactions_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_interactions_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_interactions_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_likes: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_likes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_likes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_likes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_likes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      timeline_shares: {
        Row: {
          created_at: string;
          id: string;
          original_event_id: string;
          share_text: string | null;
          user_id: string;
          visibility: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          original_event_id: string;
          share_text?: string | null;
          user_id: string;
          visibility?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          original_event_id?: string;
          share_text?: string | null;
          user_id?: string;
          visibility?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_shares_original_event_id_fkey';
            columns: ['original_event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_shares_original_event_id_fkey';
            columns: ['original_event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_shares_original_event_id_fkey';
            columns: ['original_event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_shares_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          amount_btc: number;
          anonymous: boolean;
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          from_entity_id: string;
          from_entity_type: string;
          id: string;
          initiated_at: string | null;
          message: string | null;
          payment_method: string | null;
          public_visibility: boolean;
          purpose: string | null;
          settled_at: string | null;
          status: string;
          to_entity_id: string;
          to_entity_type: string;
          updated_at: string;
        };
        Insert: {
          amount_btc: number;
          anonymous?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          from_entity_id: string;
          from_entity_type: string;
          id?: string;
          initiated_at?: string | null;
          message?: string | null;
          payment_method?: string | null;
          public_visibility?: boolean;
          purpose?: string | null;
          settled_at?: string | null;
          status?: string;
          to_entity_id: string;
          to_entity_type: string;
          updated_at?: string;
        };
        Update: {
          amount_btc?: number;
          anonymous?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          from_entity_id?: string;
          from_entity_type?: string;
          id?: string;
          initiated_at?: string | null;
          message?: string | null;
          payment_method?: string | null;
          public_visibility?: boolean;
          purpose?: string | null;
          settled_at?: string | null;
          status?: string;
          to_entity_id?: string;
          to_entity_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transparency_scores: {
        Row: {
          audit_notes: string | null;
          calculation_date: string;
          created_at: string;
          details: Json;
          entity_id: string;
          entity_type: string;
          id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          audit_notes?: string | null;
          calculation_date?: string;
          created_at?: string;
          details?: Json;
          entity_id: string;
          entity_type: string;
          id?: string;
          score: number;
          updated_at?: string;
        };
        Update: {
          audit_notes?: string | null;
          calculation_date?: string;
          created_at?: string;
          details?: Json;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      typing_indicators: {
        Row: {
          conversation_id: string;
          expires_at: string;
          id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          expires_at?: string;
          id?: string;
          started_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          expires_at?: string;
          id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'typing_indicators_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversation_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'typing_indicators_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      user_ai_preferences: {
        Row: {
          auto_router_enabled: boolean | null;
          cached_total_cost_btc: number | null;
          cached_total_requests: number | null;
          cached_total_tokens: number | null;
          created_at: string | null;
          custom_instructions: string | null;
          default_model_id: string | null;
          default_tier: string | null;
          id: string;
          max_cost_btc: number | null;
          memory_enabled: boolean;
          onboarding_completed: boolean | null;
          onboarding_completed_at: string | null;
          onboarding_step: number | null;
          platform_chain_position: number;
          require_function_calling: boolean | null;
          require_vision: boolean | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          auto_router_enabled?: boolean | null;
          cached_total_cost_btc?: number | null;
          cached_total_requests?: number | null;
          cached_total_tokens?: number | null;
          created_at?: string | null;
          custom_instructions?: string | null;
          default_model_id?: string | null;
          default_tier?: string | null;
          id?: string;
          max_cost_btc?: number | null;
          memory_enabled?: boolean;
          onboarding_completed?: boolean | null;
          onboarding_completed_at?: string | null;
          onboarding_step?: number | null;
          platform_chain_position?: number;
          require_function_calling?: boolean | null;
          require_vision?: boolean | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          auto_router_enabled?: boolean | null;
          cached_total_cost_btc?: number | null;
          cached_total_requests?: number | null;
          cached_total_tokens?: number | null;
          created_at?: string | null;
          custom_instructions?: string | null;
          default_model_id?: string | null;
          default_tier?: string | null;
          id?: string;
          max_cost_btc?: number | null;
          memory_enabled?: boolean;
          onboarding_completed?: boolean | null;
          onboarding_completed_at?: string | null;
          onboarding_step?: number | null;
          platform_chain_position?: number;
          require_function_calling?: boolean | null;
          require_vision?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_api_keys: {
        Row: {
          base_url: string | null;
          created_at: string;
          default_model: string | null;
          encrypted_key: string;
          id: string;
          is_primary: boolean;
          is_valid: boolean;
          key_hint: string;
          key_name: string;
          last_used_at: string | null;
          last_validated_at: string | null;
          provider: string;
          sort_order: number;
          total_requests: number;
          total_tokens_used: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          base_url?: string | null;
          created_at?: string;
          default_model?: string | null;
          encrypted_key: string;
          id?: string;
          is_primary?: boolean;
          is_valid?: boolean;
          key_hint: string;
          key_name: string;
          last_used_at?: string | null;
          last_validated_at?: string | null;
          provider: string;
          sort_order?: number;
          total_requests?: number;
          total_tokens_used?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          base_url?: string | null;
          created_at?: string;
          default_model?: string | null;
          encrypted_key?: string;
          id?: string;
          is_primary?: boolean;
          is_valid?: boolean;
          key_hint?: string;
          key_name?: string;
          last_used_at?: string | null;
          last_validated_at?: string | null;
          provider?: string;
          sort_order?: number;
          total_requests?: number;
          total_tokens_used?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_causes: {
        Row: {
          actor_id: string;
          beneficiaries: Json | null;
          bitcoin_address: string | null;
          cause_category: string;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          distribution_rules: Json | null;
          goal_amount: number | null;
          id: string;
          is_test: boolean;
          lightning_address: string | null;
          show_on_profile: boolean | null;
          status: string | null;
          title: string;
          total_distributed: number | null;
          total_raised: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          beneficiaries?: Json | null;
          bitcoin_address?: string | null;
          cause_category: string;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          distribution_rules?: Json | null;
          goal_amount?: number | null;
          id?: string;
          is_test?: boolean;
          lightning_address?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          title: string;
          total_distributed?: number | null;
          total_raised?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          beneficiaries?: Json | null;
          bitcoin_address?: string | null;
          cause_category?: string;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          distribution_rules?: Json | null;
          goal_amount?: number | null;
          id?: string;
          is_test?: boolean;
          lightning_address?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          title?: string;
          total_distributed?: number | null;
          total_raised?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_causes_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      user_documents: {
        Row: {
          actor_id: string;
          content: string | null;
          created_at: string;
          document_type: Database['public']['Enums']['document_type'];
          file_size_bytes: number | null;
          file_type: string | null;
          file_url: string | null;
          id: string;
          summary: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string;
          visibility: Database['public']['Enums']['document_visibility'];
        };
        Insert: {
          actor_id: string;
          content?: string | null;
          created_at?: string;
          document_type?: Database['public']['Enums']['document_type'];
          file_size_bytes?: number | null;
          file_type?: string | null;
          file_url?: string | null;
          id?: string;
          summary?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['document_visibility'];
        };
        Update: {
          actor_id?: string;
          content?: string | null;
          created_at?: string;
          document_type?: Database['public']['Enums']['document_type'];
          file_size_bytes?: number | null;
          file_type?: string | null;
          file_url?: string | null;
          id?: string;
          summary?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['document_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'user_documents_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      user_economic_profile: {
        Row: {
          asked_for: Json;
          assets: Json;
          constraints: Json;
          created_at: string;
          goals: Json;
          motivation: string | null;
          skills: Json;
          stage: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asked_for?: Json;
          assets?: Json;
          constraints?: Json;
          created_at?: string;
          goals?: Json;
          motivation?: string | null;
          skills?: Json;
          stage?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asked_for?: Json;
          assets?: Json;
          constraints?: Json;
          created_at?: string;
          goals?: Json;
          motivation?: string | null;
          skills?: Json;
          stage?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_nudges: {
        Row: {
          body: string;
          cta_label: string | null;
          cta_url: string | null;
          dedupe_key: string;
          dismissed_at: string | null;
          generated_at: string;
          id: string;
          nudge_type: string;
          score: number;
          status: string;
          title: string;
          user_id: string;
        };
        Insert: {
          body: string;
          cta_label?: string | null;
          cta_url?: string | null;
          dedupe_key: string;
          dismissed_at?: string | null;
          generated_at?: string;
          id?: string;
          nudge_type: string;
          score?: number;
          status?: string;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          cta_label?: string | null;
          cta_url?: string | null;
          dedupe_key?: string;
          dismissed_at?: string | null;
          generated_at?: string;
          id?: string;
          nudge_type?: string;
          score?: number;
          status?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_plans: {
        Row: {
          created_at: string;
          daily_limit: number;
          expires_at: string | null;
          last_invoice_id: string | null;
          payment_method: string | null;
          started_at: string;
          tier: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          daily_limit?: number;
          expires_at?: string | null;
          last_invoice_id?: string | null;
          payment_method?: string | null;
          started_at?: string;
          tier?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          daily_limit?: number;
          expires_at?: string | null;
          last_invoice_id?: string | null;
          payment_method?: string | null;
          started_at?: string;
          tier?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_presence: {
        Row: {
          last_seen_at: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          last_seen_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          last_seen_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_products: {
        Row: {
          actor_id: string;
          category: string | null;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          fulfillment_type: string | null;
          group_id: string | null;
          id: string;
          images: string[] | null;
          inventory_count: number | null;
          is_featured: boolean | null;
          is_test: boolean;
          price: number;
          product_type: string | null;
          show_on_profile: boolean | null;
          status: string | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          category?: string | null;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          fulfillment_type?: string | null;
          group_id?: string | null;
          id?: string;
          images?: string[] | null;
          inventory_count?: number | null;
          is_featured?: boolean | null;
          is_test?: boolean;
          price: number;
          product_type?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          category?: string | null;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          fulfillment_type?: string | null;
          group_id?: string | null;
          id?: string;
          images?: string[] | null;
          inventory_count?: number | null;
          is_featured?: boolean | null;
          is_test?: boolean;
          price?: number;
          product_type?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_products_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_products_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      user_services: {
        Row: {
          actor_id: string;
          availability_schedule: Json | null;
          category: string;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          duration_minutes: number | null;
          fixed_price: number | null;
          group_id: string | null;
          hourly_rate: number | null;
          id: string;
          images: string[] | null;
          is_test: boolean;
          portfolio_links: string[] | null;
          service_area: string | null;
          service_location_type: string | null;
          show_on_profile: boolean | null;
          status: string | null;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          availability_schedule?: Json | null;
          category: string;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          fixed_price?: number | null;
          group_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          images?: string[] | null;
          is_test?: boolean;
          portfolio_links?: string[] | null;
          service_area?: string | null;
          service_location_type?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          availability_schedule?: Json | null;
          category?: string;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          fixed_price?: number | null;
          group_id?: string | null;
          hourly_rate?: number | null;
          id?: string;
          images?: string[] | null;
          is_test?: boolean;
          portfolio_links?: string[] | null;
          service_area?: string | null;
          service_location_type?: string | null;
          show_on_profile?: boolean | null;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_services_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_services_group_id_fkey';
            columns: ['group_id'];
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      wallets: {
        Row: {
          address_or_xpub: string | null;
          balance_btc: number;
          balance_updated_at: string | null;
          behavior_type: string;
          budget_amount: number | null;
          budget_period: string | null;
          category: string;
          category_icon: string;
          created_at: string;
          description: string | null;
          display_order: number;
          goal_amount: number | null;
          goal_currency: string | null;
          goal_deadline: string | null;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          label: string;
          lightning_address: string | null;
          next_derivation_index: number;
          nwc_connection_uri: string | null;
          profile_id: string | null;
          project_id: string | null;
          updated_at: string;
          user_id: string | null;
          wallet_type: string;
        };
        Insert: {
          address_or_xpub?: string | null;
          balance_btc?: number;
          balance_updated_at?: string | null;
          behavior_type?: string;
          budget_amount?: number | null;
          budget_period?: string | null;
          category?: string;
          category_icon?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          goal_amount?: number | null;
          goal_currency?: string | null;
          goal_deadline?: string | null;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          label: string;
          lightning_address?: string | null;
          next_derivation_index?: number;
          nwc_connection_uri?: string | null;
          profile_id?: string | null;
          project_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          wallet_type?: string;
        };
        Update: {
          address_or_xpub?: string | null;
          balance_btc?: number;
          balance_updated_at?: string | null;
          behavior_type?: string;
          budget_amount?: number | null;
          budget_period?: string | null;
          category?: string;
          category_icon?: string;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          goal_amount?: number | null;
          goal_currency?: string | null;
          goal_deadline?: string | null;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          label?: string;
          lightning_address?: string | null;
          next_derivation_index?: number;
          nwc_connection_uri?: string | null;
          profile_id?: string | null;
          project_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          wallet_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wallets_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          attempt_count: number;
          created_at: string;
          endpoint_id: string;
          event_id: string;
          event_type: string;
          id: string;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          payload: Json;
          response_body: string | null;
          response_status: number | null;
          status: string;
        };
        Insert: {
          attempt_count?: number;
          created_at?: string;
          endpoint_id: string;
          event_id: string;
          event_type: string;
          id?: string;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          payload: Json;
          response_body?: string | null;
          response_status?: number | null;
          status?: string;
        };
        Update: {
          attempt_count?: number;
          created_at?: string;
          endpoint_id?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          payload?: Json;
          response_body?: string | null;
          response_status?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_deliveries_endpoint_id_fkey';
            columns: ['endpoint_id'];
            referencedRelation: 'webhook_endpoints';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_endpoints: {
        Row: {
          actor_id: string;
          created_at: string;
          event_types: string[] | null;
          id: string;
          last_delivery_at: string | null;
          name: string;
          revoked_at: string | null;
          secret_encrypted: string;
          secret_prefix: string;
          url: string;
          user_id: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          event_types?: string[] | null;
          id?: string;
          last_delivery_at?: string | null;
          name: string;
          revoked_at?: string | null;
          secret_encrypted: string;
          secret_prefix: string;
          url: string;
          user_id: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          event_types?: string[] | null;
          id?: string;
          last_delivery_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          secret_encrypted?: string;
          secret_prefix?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_endpoints_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_contributions: {
        Row: {
          amount_btc: number;
          contributor_actor_id: string | null;
          created_at: string | null;
          id: string;
          is_anonymous: boolean | null;
          message: string | null;
          paid_at: string | null;
          payment_hash: string | null;
          payment_status: string | null;
          wishlist_item_id: string;
        };
        Insert: {
          amount_btc: number;
          contributor_actor_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_anonymous?: boolean | null;
          message?: string | null;
          paid_at?: string | null;
          payment_hash?: string | null;
          payment_status?: string | null;
          wishlist_item_id: string;
        };
        Update: {
          amount_btc?: number;
          contributor_actor_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_anonymous?: boolean | null;
          message?: string | null;
          paid_at?: string | null;
          payment_hash?: string | null;
          payment_status?: string | null;
          wishlist_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_contributions_contributor_actor_id_fkey';
            columns: ['contributor_actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_contributions_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_item_with_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_contributions_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_items';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_feedback: {
        Row: {
          actor_id: string;
          comment: string | null;
          created_at: string | null;
          feedback_type: string;
          fulfillment_proof_id: string | null;
          id: string;
          wishlist_item_id: string;
        };
        Insert: {
          actor_id: string;
          comment?: string | null;
          created_at?: string | null;
          feedback_type: string;
          fulfillment_proof_id?: string | null;
          id?: string;
          wishlist_item_id: string;
        };
        Update: {
          actor_id?: string;
          comment?: string | null;
          created_at?: string | null;
          feedback_type?: string;
          fulfillment_proof_id?: string | null;
          id?: string;
          wishlist_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_feedback_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_feedback_fulfillment_proof_id_fkey';
            columns: ['fulfillment_proof_id'];
            referencedRelation: 'wishlist_fulfillment_proofs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_feedback_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_item_with_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_feedback_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_items';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_fulfillment_proofs: {
        Row: {
          created_at: string | null;
          description: string;
          id: string;
          image_url: string | null;
          is_verified: boolean | null;
          proof_type: string;
          transaction_id: string | null;
          wishlist_item_id: string;
        };
        Insert: {
          created_at?: string | null;
          description: string;
          id?: string;
          image_url?: string | null;
          is_verified?: boolean | null;
          proof_type: string;
          transaction_id?: string | null;
          wishlist_item_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_verified?: boolean | null;
          proof_type?: string;
          transaction_id?: string | null;
          wishlist_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_fulfillment_proofs_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_item_with_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_fulfillment_proofs_wishlist_item_id_fkey';
            columns: ['wishlist_item_id'];
            referencedRelation: 'wishlist_items';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_items: {
        Row: {
          allow_partial_funding: boolean | null;
          created_at: string | null;
          currency: string | null;
          dedicated_wallet_address: string | null;
          description: string | null;
          external_source: string | null;
          external_url: string | null;
          funded_amount_btc: number | null;
          id: string;
          image_url: string | null;
          is_fulfilled: boolean | null;
          is_fully_funded: boolean | null;
          original_amount: number | null;
          priority: number | null;
          product_id: string | null;
          quantity_received: number | null;
          quantity_wanted: number | null;
          service_id: string | null;
          target_amount_btc: number;
          title: string;
          updated_at: string | null;
          use_dedicated_wallet: boolean | null;
          wishlist_id: string;
        };
        Insert: {
          allow_partial_funding?: boolean | null;
          created_at?: string | null;
          currency?: string | null;
          dedicated_wallet_address?: string | null;
          description?: string | null;
          external_source?: string | null;
          external_url?: string | null;
          funded_amount_btc?: number | null;
          id?: string;
          image_url?: string | null;
          is_fulfilled?: boolean | null;
          is_fully_funded?: boolean | null;
          original_amount?: number | null;
          priority?: number | null;
          product_id?: string | null;
          quantity_received?: number | null;
          quantity_wanted?: number | null;
          service_id?: string | null;
          target_amount_btc: number;
          title: string;
          updated_at?: string | null;
          use_dedicated_wallet?: boolean | null;
          wishlist_id: string;
        };
        Update: {
          allow_partial_funding?: boolean | null;
          created_at?: string | null;
          currency?: string | null;
          dedicated_wallet_address?: string | null;
          description?: string | null;
          external_source?: string | null;
          external_url?: string | null;
          funded_amount_btc?: number | null;
          id?: string;
          image_url?: string | null;
          is_fulfilled?: boolean | null;
          is_fully_funded?: boolean | null;
          original_amount?: number | null;
          priority?: number | null;
          product_id?: string | null;
          quantity_received?: number | null;
          quantity_wanted?: number | null;
          service_id?: string | null;
          target_amount_btc?: number;
          title?: string;
          updated_at?: string | null;
          use_dedicated_wallet?: boolean | null;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'user_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'user_services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_wishlist_id_fkey';
            columns: ['wishlist_id'];
            referencedRelation: 'wishlist_with_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_wishlist_id_fkey';
            columns: ['wishlist_id'];
            referencedRelation: 'wishlists';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlists: {
        Row: {
          actor_id: string;
          cover_image_url: string | null;
          created_at: string | null;
          description: string | null;
          event_date: string | null;
          id: string;
          is_active: boolean | null;
          is_test: boolean;
          show_on_profile: boolean | null;
          title: string;
          type: string;
          updated_at: string | null;
          visibility: string;
        };
        Insert: {
          actor_id: string;
          cover_image_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_test?: boolean;
          show_on_profile?: boolean | null;
          title: string;
          type?: string;
          updated_at?: string | null;
          visibility?: string;
        };
        Update: {
          actor_id?: string;
          cover_image_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_test?: boolean;
          show_on_profile?: boolean | null;
          title?: string;
          type?: string;
          updated_at?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlists_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      ai_cost_analytics: {
        Row: {
          assistant_id: string | null;
          assistant_title: string | null;
          avg_cost_per_message: number | null;
          creator_id: string | null;
          total_api_cost_btc: number | null;
          total_cost_btc: number | null;
          total_creator_earnings_btc: number | null;
          total_messages: number | null;
          total_tokens: number | null;
          unique_users: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_assistants_user_id_fkey';
            columns: ['creator_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      community_timeline_no_duplicates: {
        Row: {
          actor_data: Json | null;
          actor_id: string | null;
          comment_count: number | null;
          created_at: string | null;
          description: string | null;
          event_timestamp: string | null;
          event_type: string | null;
          id: string | null;
          like_count: number | null;
          metadata: Json | null;
          share_count: number | null;
          subject_data: Json | null;
          subject_id: string | null;
          subject_type: string | null;
          title: string | null;
          updated_at: string | null;
          visibility: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_events_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_details: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          id: string | null;
          is_group: boolean | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_message_sender_id: string | null;
          participants: Json | null;
          title: string | null;
          unread_count: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string | null;
          is_group?: boolean | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          participants?: never;
          title?: string | null;
          unread_count?: never;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          id?: string | null;
          is_group?: boolean | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_sender_id?: string | null;
          participants?: never;
          title?: string | null;
          unread_count?: never;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_last_message_sender_id_fkey';
            columns: ['last_message_sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      enriched_timeline_events: {
        Row: {
          actor_data: Json | null;
          actor_id: string | null;
          actor_type: string | null;
          amount_btc: number | null;
          comment_count: number | null;
          content: Json | null;
          created_at: string | null;
          description: string | null;
          event_subtype: string | null;
          event_timestamp: string | null;
          event_type: string | null;
          id: string | null;
          is_deleted: boolean | null;
          is_featured: boolean | null;
          like_count: number | null;
          metadata: Json | null;
          parent_event_id: string | null;
          quantity: number | null;
          share_count: number | null;
          subject_data: Json | null;
          subject_id: string | null;
          subject_type: string | null;
          tags: string[] | null;
          target_data: Json | null;
          target_id: string | null;
          target_type: string | null;
          thread_id: string | null;
          title: string | null;
          updated_at: string | null;
          visibility: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'timeline_events_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'community_timeline_no_duplicates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'enriched_timeline_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'timeline_events_thread_id_fkey';
            columns: ['thread_id'];
            referencedRelation: 'timeline_events';
            referencedColumns: ['id'];
          },
        ];
      };
      message_details: {
        Row: {
          content: string | null;
          conversation_id: string | null;
          created_at: string | null;
          edited_at: string | null;
          id: string | null;
          is_deleted: boolean | null;
          is_read: boolean | null;
          message_type: string | null;
          metadata: Json | null;
          sender: Json | null;
          sender_id: string | null;
          updated_at: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversation_details';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_item_with_stats: {
        Row: {
          allow_partial_funding: boolean | null;
          contribution_count: number | null;
          contributor_count: number | null;
          created_at: string | null;
          currency: string | null;
          dedicated_wallet_address: string | null;
          description: string | null;
          dislike_count: number | null;
          external_source: string | null;
          external_url: string | null;
          funded_amount_btc: number | null;
          id: string | null;
          image_url: string | null;
          is_fulfilled: boolean | null;
          is_fully_funded: boolean | null;
          like_count: number | null;
          original_amount: number | null;
          priority: number | null;
          product_id: string | null;
          quantity_received: number | null;
          quantity_wanted: number | null;
          service_id: string | null;
          target_amount_btc: number | null;
          title: string | null;
          updated_at: string | null;
          use_dedicated_wallet: boolean | null;
          wishlist_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'user_products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'user_services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_wishlist_id_fkey';
            columns: ['wishlist_id'];
            referencedRelation: 'wishlist_with_stats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlist_items_wishlist_id_fkey';
            columns: ['wishlist_id'];
            referencedRelation: 'wishlists';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlist_with_stats: {
        Row: {
          actor_id: string | null;
          cover_image_url: string | null;
          created_at: string | null;
          description: string | null;
          event_date: string | null;
          fulfilled_item_count: number | null;
          funded_item_count: number | null;
          id: string | null;
          is_active: boolean | null;
          item_count: number | null;
          title: string | null;
          total_funded_btc: number | null;
          total_target_btc: number | null;
          type: string | null;
          updated_at: string | null;
          visibility: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlists_actor_id_fkey';
            columns: ['actor_id'];
            referencedRelation: 'actors';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      accept_group_invitation: {
        Args: { invitation_id: string };
        Returns: Json;
      };
      add_timeline_comment: {
        Args: {
          p_content: string;
          p_event_id: string;
          p_parent_comment_id?: string;
          p_user_id: string;
        };
        Returns: {
          comment_count: number;
          comment_id: string;
        }[];
      };
      allocate_derivation_index: {
        Args: { p_wallet_id: string };
        Returns: number;
      };
      cancel_ai_withdrawal: {
        Args: { p_withdrawal_id: string };
        Returns: undefined;
      };
      cat_credit_append: {
        Args: {
          p_allow_overdraw?: boolean;
          p_amount_btc: number;
          p_kind: string;
          p_metadata?: Json;
          p_ref?: string;
          p_user_id: string;
        };
        Returns: number;
      };
      cat_credit_balance: { Args: { p_user_id: string }; Returns: number };
      check_booking_conflict: {
        Args: {
          p_bookable_id: string;
          p_bookable_type: string;
          p_ends_at: string;
          p_exclude_booking_id?: string;
          p_starts_at: string;
        };
        Returns: boolean;
      };
      check_cat_permission: {
        Args: { p_action_id: string; p_user_id: string };
        Returns: boolean;
      };
      check_platform_limit: {
        Args: { p_user_id: string };
        Returns: {
          can_use_platform: boolean;
          daily_limit: number;
          daily_requests: number;
          requests_remaining: number;
        }[];
      };
      cleanup_expired_invitations: { Args: never; Returns: number };
      complete_ai_withdrawal: {
        Args: { p_withdrawal_id: string };
        Returns: undefined;
      };
      count_orphaned_profiles: { Args: never; Returns: number };
      create_direct_conversation: {
        Args: { participant1_id: string; participant2_id: string };
        Returns: string;
      };
      create_group_conversation: {
        Args: {
          p_created_by: string;
          p_participant_ids: string[];
          p_title?: string;
        };
        Returns: string;
      };
      create_loan_offer: {
        Args: {
          p_interest_rate?: number;
          p_loan_id: string;
          p_offer_amount: number;
          p_offer_type: string;
          p_offerer_id: string;
          p_term_months?: number;
          p_terms?: string;
        };
        Returns: Json;
      };
      create_post_with_visibility: {
        Args: {
          p_actor_id: string;
          p_description?: string;
          p_event_type: string;
          p_metadata?: Json;
          p_subject_id?: string;
          p_subject_type?: string;
          p_timeline_contexts?: Json;
          p_title?: string;
          p_visibility?: string;
        };
        Returns: Json;
      };
      create_quote_reply: {
        Args: {
          p_actor_id: string;
          p_content: string;
          p_parent_event_id: string;
          p_quoted_content: string;
          p_visibility?: string;
        };
        Returns: string;
      };
      create_task_broadcast_notification: {
        Args: {
          p_exclude_user_id: string;
          p_message: string;
          p_task_id: string;
          p_title: string;
          p_type: string;
        };
        Returns: undefined;
      };
      create_task_notification: {
        Args: {
          p_message: string;
          p_recipient_user_id: string;
          p_source_user_id: string;
          p_task_id: string;
          p_title: string;
          p_type: string;
        };
        Returns: string;
      };
      decline_group_invitation: {
        Args: { invitation_id: string };
        Returns: Json;
      };
      decrement_inventory: {
        Args: { p_entity_id: string; p_entity_type: string };
        Returns: undefined;
      };
      delete_timeline_comment: {
        Args: { p_comment_id: string; p_user_id: string };
        Returns: boolean;
      };
      dislike_timeline_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: {
          dislike_count: number;
        }[];
      };
      expire_cat_pending_actions: { Args: never; Returns: undefined };
      f_score: { Args: { doc: string; needle: string }; Returns: number };
      f_unaccent: { Args: { '': string }; Returns: string };
      fail_ai_withdrawal: {
        Args: { p_reason?: string; p_withdrawal_id: string };
        Returns: undefined;
      };
      generate_invitation_token: { Args: never; Returns: string };
      get_available_loans: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: {
          actor_id: string;
          amount: number;
          bitcoin_address: string | null;
          contact_method: string | null;
          created_at: string;
          currency: string | null;
          current_interest_rate: number | null;
          current_lender: string | null;
          description: string | null;
          desired_rate: number | null;
          fulfillment_type: string | null;
          id: string;
          interest_rate: number | null;
          is_negotiable: boolean | null;
          is_public: boolean | null;
          is_test: boolean;
          lender_name: string | null;
          lightning_address: string | null;
          loan_category_id: string | null;
          loan_number: string | null;
          loan_type: string | null;
          maturity_date: string | null;
          minimum_offer_amount: number | null;
          monthly_payment: number | null;
          original_amount: number;
          origination_date: string | null;
          paid_off_at: string | null;
          preferred_terms: string | null;
          remaining_balance: number;
          show_on_profile: boolean | null;
          status: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'loans';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_cat_action_daily_usage: {
        Args: { p_action_id: string; p_user_id: string };
        Returns: number;
      };
      get_comment_replies: {
        Args: { p_comment_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          content: string;
          created_at: string;
          event_id: string;
          id: string;
          parent_comment_id: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_comment_reply_count: { Args: { comment_id: string }; Returns: number };
      get_enriched_timeline_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string };
        Returns: {
          actor_id: string;
          comment_count: number;
          content: Json;
          created_at: string;
          event_type: string;
          id: string;
          like_count: number;
          share_count: number;
          user_liked: boolean;
          user_shared: boolean;
          visibility: string;
        }[];
      };
      get_entities_funding_stats: {
        Args: { p_entity_ids: string[]; p_entity_type: string };
        Returns: {
          contributor_count: number;
          entity_id: string;
          named_supporter_count: number;
          total_btc: number;
        }[];
      };
      get_entity_funding_stats: {
        Args: { p_entity_id: string; p_entity_type: string };
        Returns: {
          contributor_count: number;
          named_supporter_count: number;
          total_btc: number;
        }[];
      };
      get_event_comment_count: { Args: { event_id: string }; Returns: number };
      get_event_comments: {
        Args: { p_event_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          content: string;
          created_at: string;
          event_id: string;
          id: string;
          parent_comment_id: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_event_dislike_count: { Args: { event_id: string }; Returns: number };
      get_event_like_count: { Args: { event_id: string }; Returns: number };
      get_event_share_count: { Args: { event_id: string }; Returns: number };
      get_following_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string };
        Returns: {
          actor_id: string | null;
          actor_type: string | null;
          amount_btc: number | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          description: string | null;
          device_info: Json | null;
          event_subtype: string | null;
          event_timestamp: string;
          event_type: string;
          id: string;
          is_cross_post_duplicate: boolean | null;
          is_deleted: boolean | null;
          is_featured: boolean | null;
          is_quote_reply: boolean | null;
          location_data: Json | null;
          metadata: Json | null;
          parent_event_id: string | null;
          quantity: number | null;
          subject_id: string | null;
          subject_type: string;
          tags: string[] | null;
          target_id: string | null;
          target_type: string | null;
          thread_depth: number | null;
          thread_id: string | null;
          title: string;
          updated_at: string;
          visibility: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'timeline_events';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_group_member_count: { Args: { group_uuid: string }; Returns: number };
      get_group_role: {
        Args: { group_uuid: string; user_uuid: string };
        Returns: string;
      };
      get_or_create_user_ai_preferences: {
        Args: { p_user_id: string };
        Returns: {
          auto_router_enabled: boolean | null;
          cached_total_cost_btc: number | null;
          cached_total_requests: number | null;
          cached_total_tokens: number | null;
          created_at: string | null;
          custom_instructions: string | null;
          default_model_id: string | null;
          default_tier: string | null;
          id: string;
          max_cost_btc: number | null;
          memory_enabled: boolean;
          onboarding_completed: boolean | null;
          onboarding_completed_at: string | null;
          onboarding_step: number | null;
          platform_chain_position: number;
          require_function_calling: boolean | null;
          require_vision: boolean | null;
          updated_at: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'user_ai_preferences';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_thread_posts: {
        Args: { p_limit?: number; p_offset?: number; p_thread_id: string };
        Returns: {
          actor_id: string | null;
          actor_type: string | null;
          amount_btc: number | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          description: string | null;
          device_info: Json | null;
          event_subtype: string | null;
          event_timestamp: string;
          event_type: string;
          id: string;
          is_cross_post_duplicate: boolean | null;
          is_deleted: boolean | null;
          is_featured: boolean | null;
          is_quote_reply: boolean | null;
          location_data: Json | null;
          metadata: Json | null;
          parent_event_id: string | null;
          quantity: number | null;
          subject_id: string | null;
          subject_type: string;
          tags: string[] | null;
          target_id: string | null;
          target_type: string | null;
          thread_depth: number | null;
          thread_id: string | null;
          title: string;
          updated_at: string;
          visibility: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'timeline_events';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_total_unread_count: { Args: { p_user_id: string }; Returns: number };
      get_unread_counts: {
        Args: { p_user_id: string };
        Returns: {
          conversation_id: string;
          unread_count: number;
        }[];
      };
      get_user_conversations: {
        Args: { p_user_id: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          is_group: boolean;
          last_message_at: string;
          last_message_preview: string;
          last_message_sender_id: string;
          participants: Json;
          title: string;
          unread_count: number;
          updated_at: string;
        }[];
      };
      get_user_group_role: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: string;
      };
      get_user_groups: {
        Args: { user_uuid: string };
        Returns: {
          group_id: string;
          group_name: string;
          group_slug: string;
          joined_at: string;
          label: string;
          role: string;
        }[];
      };
      get_user_loans: {
        Args: { p_user_id: string };
        Returns: {
          id: string;
          interest_rate: number;
          last_payment_date: string;
          pending_offers: number;
          remaining_balance: number;
          status: string;
          title: string;
          total_offers: number;
        }[];
      };
      get_user_pending_invitations: {
        Args: { user_uuid?: string };
        Returns: {
          created_at: string;
          expires_at: string;
          group_avatar_url: string;
          group_id: string;
          group_name: string;
          group_slug: string;
          id: string;
          inviter_avatar_url: string;
          inviter_id: string;
          inviter_name: string;
          message: string;
          role: string;
        }[];
      };
      get_user_timeline_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string };
        Returns: {
          actor_id: string | null;
          actor_type: string | null;
          amount_btc: number | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          description: string | null;
          device_info: Json | null;
          event_subtype: string | null;
          event_timestamp: string;
          event_type: string;
          id: string;
          is_cross_post_duplicate: boolean | null;
          is_deleted: boolean | null;
          is_featured: boolean | null;
          is_quote_reply: boolean | null;
          location_data: Json | null;
          metadata: Json | null;
          parent_event_id: string | null;
          quantity: number | null;
          subject_id: string | null;
          subject_type: string;
          tags: string[] | null;
          target_id: string | null;
          target_type: string | null;
          thread_depth: number | null;
          thread_id: string | null;
          title: string;
          updated_at: string;
          visibility: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'timeline_events';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      global_search: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          entity_type: string;
          id: string;
          image_url: string;
          rank: number;
          subtitle: string;
          title: string;
        }[];
      };
      has_user_disliked_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: boolean;
      };
      has_user_liked_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: boolean;
      };
      has_user_shared_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: boolean;
      };
      increment_ai_revenue: {
        Args: { p_amount: number; p_assistant_id: string; p_creator_id: string };
        Returns: undefined;
      };
      increment_platform_usage: {
        Args: {
          p_request_count?: number;
          p_token_count?: number;
          p_user_id: string;
        };
        Returns: {
          daily_requests: number;
          daily_tokens: number;
          limit_reached: boolean;
        }[];
      };
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: boolean;
      };
      like_timeline_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: {
          like_count: number;
        }[];
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_user_id: string };
        Returns: undefined;
      };
      match_cat_forgotten_facts: {
        Args: {
          match_count?: number;
          min_similarity?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          similarity: number;
        }[];
      };
      match_cat_memories: {
        Args: {
          match_count?: number;
          min_similarity?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          similarity: number;
        }[];
      };
      match_content:
        | {
            Args: {
              filter_type?: string;
              match_count?: number;
              query_embedding: string;
            };
            Returns: {
              entity_id: string;
              entity_type: string;
              similarity: number;
              text_preview: string;
              title: string;
              url: string;
            }[];
          }
        | {
            Args: {
              filter_type?: string;
              match_count?: number;
              min_similarity?: number;
              query_embedding: string;
            };
            Returns: {
              entity_id: string;
              entity_type: string;
              quality_score: number;
              score: number;
              similarity: number;
              text_preview: string;
              title: string;
              url: string;
            }[];
          };
      match_interested_people: {
        Args: {
          exclude_user: string;
          match_count?: number;
          min_similarity?: number;
          query_embedding: string;
        };
        Returns: {
          similarity: number;
          topic: string;
          user_id: string;
        }[];
      };
      request_ai_withdrawal: {
        Args: { p_amount: number; p_creator_id: string; p_destination: string };
        Returns: string;
      };
      search_profiles_fts: {
        Args: { p_limit?: number; p_offset?: number; p_query: string };
        Returns: {
          avatar_url: string;
          bio: string;
          created_at: string;
          id: string;
          latitude: number;
          location_city: string;
          location_country: string;
          location_zip: string;
          longitude: number;
          name: string;
          username: string;
        }[];
      };
      search_profiles_nearby: {
        Args: {
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_offset?: number;
          p_query?: string;
          p_radius_km: number;
        };
        Returns: {
          avatar_url: string;
          bio: string;
          created_at: string;
          distance_km: number;
          id: string;
          latitude: number;
          location_city: string;
          location_country: string;
          location_zip: string;
          longitude: number;
          name: string;
          username: string;
        }[];
      };
      search_projects_fts: {
        Args: { p_limit?: number; p_offset?: number; p_query: string };
        Returns: {
          bitcoin_address: string;
          category: string;
          cover_image_url: string;
          created_at: string;
          currency: string;
          description: string;
          goal_amount: number;
          id: string;
          raised_amount: number;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      search_projects_nearby: {
        Args: {
          p_lat: number;
          p_limit?: number;
          p_lng: number;
          p_offset?: number;
          p_query?: string;
          p_radius_km: number;
        };
        Returns: {
          bitcoin_address: string;
          category: string;
          cover_image_url: string;
          created_at: string;
          currency: string;
          description: string;
          distance_km: number;
          goal_amount: number;
          id: string;
          location_city: string;
          location_coordinates: unknown;
          location_country: string;
          raised_amount: number;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      send_message: {
        Args: {
          p_content: string;
          p_conversation_id: string;
          p_message_type?: string;
          p_metadata?: Json;
          p_sender_id: string;
        };
        Returns: string;
      };
      share_timeline_event: {
        Args: {
          p_original_event_id: string;
          p_share_text?: string;
          p_user_id?: string;
          p_visibility?: string;
        };
        Returns: Json;
      };
      soft_delete_timeline_event: {
        Args: { event_id: string; reason?: string };
        Returns: boolean;
      };
      transfer_between_wallets: {
        Args: {
          p_amount_btc: number;
          p_from_wallet_id: string;
          p_to_wallet_id: string;
          p_transaction_id: string;
        };
        Returns: undefined;
      };
      undislike_timeline_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: {
          dislike_count: number;
        }[];
      };
      unlike_timeline_event: {
        Args: { p_event_id: string; p_user_id: string };
        Returns: {
          like_count: number;
        }[];
      };
      update_key_usage: {
        Args: { p_key_id: string; p_tokens_used?: number };
        Returns: undefined;
      };
      update_timeline_comment: {
        Args: { p_comment_id: string; p_content: string; p_user_id: string };
        Returns: boolean;
      };
      user_is_participant: {
        Args: { p_conversation_id: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      ai_assistant_status: 'draft' | 'active' | 'paused' | 'archived';
      ai_pricing_model: 'per_message' | 'per_token' | 'subscription' | 'free';
      cat_action_category:
        'entities' | 'communication' | 'payments' | 'organization' | 'settings' | 'context';
      cat_action_status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'denied';
      compute_provider_type: 'api' | 'self_hosted' | 'community';
      document_type: 'goals' | 'finances' | 'skills' | 'notes' | 'business_plan' | 'other';
      document_visibility: 'private' | 'cat_visible' | 'public';
      governance_model_enum: 'hierarchical' | 'democratic' | 'consensus' | 'dao' | 'other';
      membership_role_enum: 'owner' | 'admin' | 'moderator' | 'member' | 'guest';
      membership_status_enum: 'active' | 'pending' | 'suspended' | 'left' | 'banned';
      organization_type_enum:
        'non_profit' | 'business' | 'dao' | 'community' | 'foundation' | 'other';
      support_type: 'bitcoin_funding' | 'signature' | 'message' | 'reaction';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_assistant_status: ['draft', 'active', 'paused', 'archived'],
      ai_pricing_model: ['per_message', 'per_token', 'subscription', 'free'],
      cat_action_category: [
        'entities',
        'communication',
        'payments',
        'organization',
        'settings',
        'context',
      ],
      cat_action_status: ['pending', 'executing', 'completed', 'failed', 'cancelled', 'denied'],
      compute_provider_type: ['api', 'self_hosted', 'community'],
      document_type: ['goals', 'finances', 'skills', 'notes', 'business_plan', 'other'],
      document_visibility: ['private', 'cat_visible', 'public'],
      governance_model_enum: ['hierarchical', 'democratic', 'consensus', 'dao', 'other'],
      membership_role_enum: ['owner', 'admin', 'moderator', 'member', 'guest'],
      membership_status_enum: ['active', 'pending', 'suspended', 'left', 'banned'],
      organization_type_enum: ['non_profit', 'business', 'dao', 'community', 'foundation', 'other'],
      support_type: ['bitcoin_funding', 'signature', 'message', 'reaction'],
    },
  },
} as const;
