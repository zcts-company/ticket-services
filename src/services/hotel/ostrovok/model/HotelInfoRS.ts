export interface HotelInfoRS {
  data: Data
  debug: any
  error: any
  status: string
}

export interface Data {
  address: string
  amenity_groups: AmenityGroup[]
  check_in_time: string
  check_out_time: string
  description_struct: DescriptionStruct[]
  email: string
  facts: Facts
  front_desk_time_end: string
  front_desk_time_start: string
  hotel_chain: string
  id: string
  images: string[]
  is_closed: boolean
  is_gender_specification_required: boolean
  kind: string
  latitude: number
  longitude: number
  metapolicy_extra_info: string
  metapolicy_struct: MetapolicyStruct
  name: string
  payment_methods: string[]
  phone: string
  policy_struct: PolicyStruct[]
  postal_code: string
  region: Region
  room_groups: RoomGroup[]
  serp_filters: string[]
  star_certificate: StarCertificate
  star_rating: number
}

export interface AmenityGroup {
  amenities: string[]
  group_name: string
}

export interface DescriptionStruct {
  paragraphs: string[]
  title: string
}

export interface Facts {
  electricity: Electricity
  floors_number: any
  rooms_number: any
  year_built: any
  year_renovated: any
}

export interface Electricity {
  frequency: number[]
  sockets: string[]
  voltage: number[]
}

export interface MetapolicyStruct {
  add_fee: any[]
  check_in_check_out: any[]
  children: any[]
  children_meal: any[]
  cot: Cot[]
  deposit: any[]
  extra_bed: any[]
  internet: any[]
  meal: any[]
  no_show: NoShow
  parking: any[]
  pets: any[]
  shuttle: any[]
  visa: Visa
}

export interface Cot {
  amount: number
  currency: string
  inclusion: string
  price: string
  price_unit: string
}

export interface NoShow {
  availability: string
  day_period: string
  time: string
}

export interface Visa {
  visa_support: string
}

export interface PolicyStruct {
  paragraphs: string[]
  title: string
}

export interface Region {
  country_code: string
  iata: string
  id: number
  name: string
  type: string
}

export interface RoomGroup {
  images: string[]
  name: string
  name_struct: NameStruct
  rg_ext: RgExt
  room_amenities: string[]
  room_group_id: number
}

export interface NameStruct {
  bathroom: string
  bedding_type: string
  main_name: string
}

export interface RgExt {
  balcony: number
  bathroom: number
  bedding: number
  bedrooms: number
  capacity: number
  class: number
  club: number
  family: number
  floor: number
  quality: number
  sex: number
  view: number
}

export interface StarCertificate {
  certificate_id: string
  valid_to: string
}
