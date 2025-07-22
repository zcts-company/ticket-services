import { UFSPassenger } from "./UFSPassenger";

export type UFSOrder = {
  UFS_RZhD_Gate: {
    OperationInfo: {
      idtrans: string;
      from: string;
      to: string;
      idzakaz: string;
      remoteCheckIn: string;
      code: string;
      status: string;
      createTime: string;
      confirmTime: string;
      arriveTime: string;
      ntrain: string;
      ncar: string;
      typeCar: string;
      deptTime: string;
      terminal: string;
      amount: string;
      type: string;
      stan: string;
      test: string;
      nextTr: string;
      prevTr: string;
      genderclass: string;
      carrier: string;
      codefrom: string;
      codeto: string;
    };
    Passengers: {
      Passenger: UFSPassenger[];
    };
  };
}

