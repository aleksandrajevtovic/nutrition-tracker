import type {Food} from './db';
const date='2026-11-15T00:00:00.000Z';
const make=(id:string,name:string,brand:string,kcal:number,protein:number,carbs:number,fat:number,fiber:number,sugar:number,portionName:string,portionGrams:number):Food=>({id,name,brand,kcal,protein,carbs,fat,fiber,sugar,portionName,portionGrams,createdAt:date});
export const starterFoods:Food[]=[
 make('lentil','Linsenwaffeln gesalzen','dmBio',367,29,55,1.7,7.2,1.4,'1 Cracker',7),
 make('pistachio','Pistazienmus 100 %','enerBio',643,18,9,57,11,4.5,'1 Teelöffel',5),
 make('banana','Banane','',89,1.1,22.8,0.3,2.6,12.2,'1 kleine Banane',100),
 make('pepper','Rote Paprika','',31,1,6,0.3,2.1,4.2,'½ Paprika',69),
 make('turkey','Putenbrust','Allgemeiner Schätzwert',105,20,2,2,0,1,'1 Scheibe',6.25),
 make('tomato','Kirschtomaten','',18,0.9,3.9,0.2,1.2,2.6,'1 Stück',17),
 make('avocado','Avocado','',160,2,8.5,14.7,6.7,0.7,'½ Avocado',97),
 make('onion','Frühlingszwiebel','',32,1.8,7.3,0.2,2.6,2.3,'1 Stück',38),
 make('egg','Gekochtes Ei','',155,12.6,1.1,10.6,0,1.1,'1 Ei',50),
 make('bread','Brot','Allgemeiner Schätzwert',250,9,47,3,5,5,'1 Scheibe',40),
 make('oil','Olivenöl','',884,0,0,100,0,0,'1 Teelöffel',5)
];
