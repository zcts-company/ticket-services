export type Room = {
        name: string;
        description: string;
        photos: string[];
        services: {
          primary: {
            hasInternet: boolean;
            hasBathroom: boolean;
          };
          secondary: {
            facilities: any[];
          };
        };
      };