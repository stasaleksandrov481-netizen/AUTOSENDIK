
/* AutoSyndicate Carbon v7 Expansion Layer */

const carbonPlates = {
  common:["A123BC","M777AA","X555XX","R001RR"],
  rare:["007","911","666","DRIFT"],
  epic:["KING","BOSS","CARBON","RACER"],
  legendary:["NFS","RAZOR","BLACKOUT"]
};

const rivalProfiles = [
 {id:"razor",name:"Razor",car:"BMW M3 E46",rating:96,style:"aggressive",line:"Надеюсь, ты умеешь переключать передачи. Сегодня пригодится."},
 {id:"viper",name:"Viper",car:"Nissan Skyline R34",rating:94,style:"technical",line:"Красивый кузов не поможет, если мотор слабый."},
 {id:"ghost",name:"Ghost",car:"Mazda RX-7 FD",rating:91,style:"drift",line:"Увидишь мои фары — значит уже проиграл."},
 {id:"zero",name:"Zero",car:"Toyota Supra MK4",rating:98,style:"speed",line:"Проверим, кто настоящий король улиц."}
];

const caseDropsV7 = [
 {type:"coins",chance:45},
 {type:"tuning",chance:25},
 {type:"plate",chance:18},
 {type:"car",chance:3},
 {type:"legendary_plate",chance:1}
];

function createVehicleInstance(carId){
 const car=carsDB.find(x=>x.id===carId);
 return {
  uid:"veh_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
  carId,
  tuning:{engine:0,turbo:0,gearbox:0,suspension:0},
  plate:null,
  history:{wins:0,owners:1}
 };
}

function attachPlate(vehicle,plate){
 if(!vehicle) return;
 vehicle.plate=plate;
}

function vehicleValue(vehicle){
 if(!vehicle) return 0;
 let value=(carsDB.find(c=>c.id===vehicle.carId)?.price||0);
 value += Object.values(vehicle.tuning||{}).reduce((a,b)=>a+b*5000,0);
 if(vehicle.plate) value += 25000;
 return value;
}

function boostedRaceSpeed(base){
 return Math.min(base*1.55,420);
}
