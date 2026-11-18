import fs from 'node:fs';
import ts from 'typescript';
const config={
  App:'tab date editing recipeCopySource importing',
  DiaryPage:'editor copying savingTemplate selectedMeal transferEntryId',
  EntryEditor:'selected meal amount unit conversions note importing creatingFood',
  FoodEditor:'reference mode draft reviewed standardOpen unitsOpen',
  RecipeEditor:'name servings finishedWeight ingredients instructions creatingFood weightOpen notesOpen',
  RecipeIngredients:'selected amount unit',
  DailyExtras:'expanded',DailySummary:'editing',DailyNotes:'values expanded',GoalEditor:'values',
  WeightTracker:'expanded editingDate',WeightEntryForm:'value',HydrationTracker:'expanded editing',DrinkForm:'name amount unit time',
  DiaryEntry:'expanded quantityEditing',QuickQuantity:'value',EntryTransferForm:'mode date meal',
  MealCopyForm:'targetDate targetMeal choices',TemplateSaveForm:'name',
  PlanningPage:'tab editor plannerDate rescheduling',PlanEditor:'source chosenTemplate food target meal name amount unit',PlanDateForm:'date',
  TemplateLibrary:'target meal factor applying',ShoppingListView:'selected portions selection',
  ProductImport:'barcode text column review assignment',BarcodeAssignment:'selected',
};
for(const [component,names] of Object.entries(config)){
  const file=component==='App'?'src/App.tsx':`src/components/${component}.tsx`;
  let source=fs.readFileSync(file,'utf8');const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
  const visit=node=>{
    if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(tree)==='useState'){
      const name=node.name.elements[0].name.text;
      if(names.split(' ').includes(name)){
        const call=node.initializer,position=call.expression.end;
        edits.push([call.expression.getStart(tree),position,'useDraftState']);
        const after=source.indexOf('(',call.typeArguments?.end ?? position)+1;
        let key=`'${component}:${name}'`;
        if(['DiaryEntry','QuickQuantity','EntryTransferForm'].includes(component))key='`'+component+':${entry.id}:'+name+'`';
        if(['FoodEditor','RecipeEditor'].includes(component))key='`'+component+':${food.id}:'+name+'`';
        if(['DailyNotes','DrinkForm','WeightEntryForm'].includes(component))key='`'+component+':${date}:'+name+'`';
        if(component==='TemplateLibrary'&&name!=='applying')key='`TemplateLibrary:${template.id}:'+name+'`';
        edits.push([after,after,key+(call.arguments.length?', ': '')]);
      }
    }
    ts.forEachChild(node,visit);
  };visit(tree);
  for(const [from,to,text] of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,from)+text+source.slice(to);
  if(!source.includes('useState(')&&!source.includes('useState<'))source=source.replace(/import \{([^}]+)\} from 'react';/,(_,members)=>{const rest=members.split(',').map(x=>x.trim()).filter(x=>x!=='useState');return rest.length?`import {${rest.join(', ')}} from 'react';`:'';});
  source=`import {useDraftState} from '${component==='App'?'./components':' .' .trim()}/DraftRecoveryProvider';\n`+source;
  fs.writeFileSync(file,source);
}
