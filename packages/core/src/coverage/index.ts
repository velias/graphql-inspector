import {
  ASTVisitor,
  FieldNode,
  GraphQLError,
  GraphQLNamedType,
  GraphQLSchema,
  isInterfaceType,
  isObjectType,
  Source,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { readDocument } from '../ast/document';
import { isForIntrospection, isPrimitive } from '../utils/graphql';

export interface Location {
  start: number;
  end: number;
}

export interface ArgumentCoverage {
  hits: number;
  fieldsCount: number;
  fieldsCountCovered: number;
  locations: {
    [name: string]: Array<Location>;
  };
}

export interface TypeChildCoverage {
  hits: number;
  fieldsCount: number;
  fieldsCountCovered: number;
  locations: {
    [name: string]: Array<Location>;
  };
  children: {
    [name: string]: ArgumentCoverage;
  };
}

export interface TypeCoverage {
  hits: number;
  fieldsCount: number;
  fieldsCountCovered: number;
  type: GraphQLNamedType;
  children: {
    [name: string]: TypeChildCoverage;
  };
}

export interface SchemaCoverage {
  sources: Source[];
  types: {
    [typename: string]: TypeCoverage;
  };
  stats: {
    numTypes: number;
    numTypesCoveredFully: number;
    numTypesCovered: number;
    numFields: number;
    numFiledsCovered: number;
  };
}

export interface InvalidDocument {
  source: Source;
  errors: ReadonlyArray<GraphQLError>;
}

export function coverage(schema: GraphQLSchema, sources: Source[]): SchemaCoverage {
  const coverage: SchemaCoverage = {
    sources,
    types: {},
    stats: {
      numTypes: 0,
      numTypesCoveredFully: 0,
      numTypesCovered: 0,
      numFields: 0,
      numFiledsCovered: 0,
    },
  };
  const typeMap = schema.getTypeMap();
  const typeInfo = new TypeInfo(schema);
  const visitor: (source: Source) => ASTVisitor = source => ({
    Field(node: FieldNode) {
      const fieldDef = typeInfo.getFieldDef();
      const parent = typeInfo.getParentType();

      if (
        parent &&
        parent.name &&
        !isForIntrospection(parent.name) &&
        fieldDef &&
        fieldDef.name &&
        fieldDef.name !== '__typename' &&
        fieldDef.name !== '__schema'
      ) {
        const sourceName = source.name;
        const typeCoverage = coverage.types[parent.name];
        const fieldCoverage = typeCoverage.children[fieldDef.name];
        const locations = fieldCoverage.locations[sourceName];

        typeCoverage.hits++;
        fieldCoverage.hits++;

        if (node.loc) {
          fieldCoverage.locations[sourceName] = [node.loc, ...(locations || [])];
        }

        if (node.arguments) {
          for (const argNode of node.arguments) {
            const argCoverage = fieldCoverage.children[argNode.name.value];

            argCoverage.hits++;

            if (argNode.loc) {
              argCoverage.locations[sourceName] = [
                argNode.loc!,
                ...(argCoverage.locations[sourceName] || []),
              ];
            }
          }
        }
      }
    },
  });

  for (const typename in typeMap) {
    if (!isForIntrospection(typename) && !isPrimitive(typename)) {
      const type = typeMap[typename];

      if (isObjectType(type) || isInterfaceType(type)) {
        const typeCoverage: TypeCoverage = {
          hits: 0,
          fieldsCount: 0,
          fieldsCountCovered: 0,
          type,
          children: {},
        };
        const fieldMap = type.getFields();

        for (const fieldname in fieldMap) {
          const field = fieldMap[fieldname];

          typeCoverage.children[field.name] = {
            hits: 0,
            fieldsCount: 0,
            fieldsCountCovered: 0,
            locations: {},
            children: {},
          };

          for (const arg of field.args) {
            typeCoverage.children[field.name].children[arg.name] = {
              hits: 0,
              fieldsCount: 0,
              fieldsCountCovered: 0,
              locations: {},
            };
          }
        }

        coverage.types[type.name] = typeCoverage;
      }
    }
  }

  const documents = coverage.sources.map(readDocument);

  documents.forEach((doc, i) => {
    const source = coverage.sources[i];
    doc.operations.forEach(op => {
      visit(op.node, visitWithTypeInfo(typeInfo, visitor(source)));
    });
    doc.fragments.forEach(fr => {
      visit(fr.node, visitWithTypeInfo(typeInfo, visitor(source)));
    });
  });

  for (const key in coverage.types) {
    const me = coverage.types[key];
    processStats(me);

    coverage.stats.numTypes++;
    if (me.fieldsCountCovered > 0) coverage.stats.numTypesCovered++;
    if (me.fieldsCount == me.fieldsCountCovered) coverage.stats.numTypesCoveredFully++;
    coverage.stats.numFields += me.fieldsCount;
    coverage.stats.numFiledsCovered += me.fieldsCountCovered;
  }

  return coverage;
}

function processStats(me: TypeCoverage | TypeChildCoverage) {
  const children = me.children;
  if (children) {
    for (const k in children) {
      const ch = children[k];

      if ((ch as TypeChildCoverage).children !== undefined) {
        processStats(ch as TypeChildCoverage);
        me.fieldsCount += ch.fieldsCount;
        me.fieldsCountCovered += ch.fieldsCountCovered;
      }

      me.fieldsCount++;
      if (ch.hits > 0) {
        me.fieldsCountCovered++;
      }
    }
  }
}
