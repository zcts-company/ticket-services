export type NemoOrder = {
    method: string
    apiVersion: string
    params: {
      type: string
      id: number
    }
    data: {
      system: string
      orderType: string
      id: number
      lastModifiedDate: string
      currentServerDate: string
      customer: {
        userId: number
        agencyId: number
        companyId: number
        backofficeCompanyId: any
        name: string
        phone: string
        email: string
      }
      passengers: any
      products: any
    }
  }
  