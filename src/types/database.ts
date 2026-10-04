export type UserRole = "admin" | "worker" | "qc_inspector";
export type ScanStatus = "pending" | "passed" | "rejected";
export type ShoeSide = "pair";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id">>;
      };
      scans: {
        Row: Scan;
        Insert: Omit<Scan, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Scan, "id">>;
      };
      scan_images: {
        Row: ScanImage;
        Insert: Omit<ScanImage, "id" | "created_at">;
        Update: Partial<Omit<ScanImage, "id">>;
      };
    };
  };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  factory_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: string;
  scan_id: string;
  worker_id: string;
  batch_id: string;
  size: string;
  status: ScanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  worker?: Profile;
  measurements?: {
    processing_metadata?: {
      autoPassed?: boolean;
      autoRejectionReason?: string;
      leftHeelHeightMm?: number;
      rightHeelHeightMm?: number;
      heightDiffMm?: number;
      toleranceMm?: number;
    } | null;
  }[];
}

export interface ScanImage {
  id: string;
  scan_id: string;
  side: ShoeSide;
  storage_path: string;
  public_url: string | null;
  created_at: string;
}
