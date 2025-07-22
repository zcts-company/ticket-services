export type Client = {
        user: {
          id: number;
          email: string;
        };
        profile: {
          id: string;
          name: string;
          finDocName: string;
        };
        agreement: {
          id: number;
          contractNumber: string;
          company: string;
        };
      }