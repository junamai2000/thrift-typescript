import * as ts from 'typescript'

import {
  ServiceDefinition,
  FunctionDefinition,
  FieldDefinition,
  SyntaxType,
} from '@creditkarma/thrift-parser'

import {
  ContextType,
  createConnectionType,
} from './types'

import {
  createStructArgsName,
  createStructResultName
} from './utils'

import {
  createClassConstructor,
  createFunctionParameter,
  createAssignmentStatement,
  createNotNull,
  createConstStatement,
  createMethodCallStatement,
  createProtectedProperty,
  createApplicationException,
} from '../utils'

import {
  createAnyType,
  createNumberType,
  typeNodeForFieldType,
} from '../types'

import {
  APPLICATION_EXCEPTION,
  COMMON_IDENTIFIERS,
  MESSAGE_TYPE,
} from '../identifiers'

export function renderClient(node: ServiceDefinition): ts.ClassDeclaration {
  // private _requestId: number;
  const requestId: ts.PropertyDeclaration = createProtectedProperty(
    '_requestId',
    createNumberType()
  )

  // public transport: TTransport;
  const transport: ts.PropertyDeclaration = createProtectedProperty(
    'transport',
    ts.createTypeReferenceNode(
      COMMON_IDENTIFIERS.TransportConstructor,
      undefined
    )
  )

  // public protocol: new (trans: TTransport) => TProtocol;
  const protocol: ts.PropertyDeclaration = createProtectedProperty(
    'protocol',
    ts.createTypeReferenceNode(
      COMMON_IDENTIFIERS.ProtocolConstructor,
      undefined,
    )
  )

  // private send: (data: Buffer, requestId: number, context: Context) => void;
  const connection: ts.PropertyDeclaration = createProtectedProperty(
    'connection',
    createConnectionType(),
  )

  /**
   * constructor(connection: ThriftConnection) {
   *   super(connection)
   *   this._requestId = 0;
   *   this.transport = connection.Transport;
   *   this.protocol = connection.Protocol;
   *   this.connection = connection;
   * }
   */
  const ctor: ts.ConstructorDeclaration = createClassConstructor(
    [
      createFunctionParameter(
        'connection',
        createConnectionType(),
      )
    ], // parameters
    [
      ...(
        (node.extends !== null) ?
          [
            ts.createStatement(ts.createCall(
              ts.createSuper(),
              [],
              [
                COMMON_IDENTIFIERS.connection,
              ]
            ))
          ] :
          []
      ),
      createAssignmentStatement(
        ts.createIdentifier('this._requestId'),
        ts.createLiteral(0)
      ),
      createAssignmentStatement(
        ts.createIdentifier('this.transport'),
        ts.createIdentifier('connection.Transport'),
      ),
      createAssignmentStatement(
        ts.createIdentifier('this.protocol'),
        ts.createIdentifier('connection.Protocol'),
      ),
      createAssignmentStatement(
        ts.createIdentifier('this.connection'),
        COMMON_IDENTIFIERS.connection,
      )
    ] // body
  )

  const incrementRequestIdMethod: ts.MethodDeclaration = ts.createMethod(
    undefined,
    [ ts.createToken(ts.SyntaxKind.PublicKeyword) ],
    undefined,
    'incrementRequestId',
    undefined,
    undefined,
    [],
    createNumberType(),
    ts.createBlock([
      ts.createReturn(
        ts.createBinary(
          ts.createIdentifier('this._requestId'),
          ts.SyntaxKind.PlusEqualsToken,
          ts.createLiteral(1)
        )
      )
    ], true)
  )

  const baseMethods: Array<ts.MethodDeclaration> = node.functions.map(createBaseMethodForDefinition)

  const heritage: Array<ts.HeritageClause> = (
    (node.extends !== null) ?
      [
        ts.createHeritageClause(
          ts.SyntaxKind.ExtendsKeyword,
          [
            ts.createExpressionWithTypeArguments(
              [
                ts.createTypeReferenceNode(
                  COMMON_IDENTIFIERS.Context,
                  undefined
                )
              ],
              ts.createIdentifier(`${node.extends.value}.Client`),
            )
          ]
        )
      ] :
      []
  )

  // export class <node.name> { ... }
  return ts.createClassDeclaration(
    undefined, // decorators
    [ ts.createToken(ts.SyntaxKind.ExportKeyword) ], // modifiers
    'Client', // name
    [
      ts.createTypeParameterDeclaration(
        COMMON_IDENTIFIERS.Context,
        undefined,
        createAnyType()
      )
    ], // type parameters
    heritage, // heritage
    [
      requestId,
      transport,
      protocol,
      connection,
      ctor,
      incrementRequestIdMethod,
      ...baseMethods,
    ] // body
  )
}

// public {{name}}( {{#args}}{{fieldName}}: {{fieldType}}, {{/args}} ): Promise<{{typeName}}> {
//     this._requestId = this.incrementSeqId()
//     return new Promise<{{typeName}}>((resolve, reject) => {
//         this._reqs[this.requestId()] = function(error, result) {
//             if (error) {
//                 reject(error)
//             } else {
//                 resolve(result)
//             }
//         }
//         this.send_{{name}}( {{#args}}{{fieldName}}, {{/args}} )
//     })
// }
function createBaseMethodForDefinition(def: FunctionDefinition): ts.MethodDeclaration {
  return ts.createMethod(
    undefined, // decorators
    [ ts.createToken(ts.SyntaxKind.PublicKeyword) ], // modifiers
    undefined, // asterisk token
    def.name.value, // name
    undefined, // question token
    undefined, // type parameters
    [
      ...def.fields.map(createParametersForField),
      createFunctionParameter(
        COMMON_IDENTIFIERS.context,
        ContextType,
        undefined,
        true,
      )
    ], // parameters
    ts.createTypeReferenceNode(
      'Promise',
      [ typeNodeForFieldType(def.returnType) ]
    ), // return type
    ts.createBlock([
      createConstStatement(
        COMMON_IDENTIFIERS.writer,
        ts.createTypeReferenceNode(
          COMMON_IDENTIFIERS.TTransport,
          undefined
        ),
        ts.createNew(
          ts.createIdentifier('this.transport'),
          undefined,
          []
        )
      ),
      createConstStatement(
        COMMON_IDENTIFIERS.output,
        ts.createTypeReferenceNode(
          COMMON_IDENTIFIERS.TProtocol,
          undefined
        ),
        ts.createNew(
          ts.createIdentifier('this.protocol'),
          undefined,
          [
            COMMON_IDENTIFIERS.writer
          ]
        )
      ),
      // output.writeMessageBegin("{{name}}", Thrift.MessageType.CALL, this.requestId())
      createMethodCallStatement(
        COMMON_IDENTIFIERS.output,
        'writeMessageBegin',
        [
          ts.createLiteral(def.name.value),
          MESSAGE_TYPE.CALL,
          ts.createCall(
            ts.createIdentifier('this.incrementRequestId'),
            undefined,
            [],
          )
        ]
      ),
      // const args = new {{ServiceName}}{{nameTitleCase}}Args( { {{#args}}{{fieldName}}, {{/args}} } )
      createConstStatement(
        COMMON_IDENTIFIERS.args,
        ts.createTypeReferenceNode(
          ts.createIdentifier(createStructArgsName(def)),
          undefined
        ),
        ts.createNew(
          ts.createIdentifier(createStructArgsName(def)),
          undefined,
          [
            ts.createObjectLiteral(
              def.fields.map((next: FieldDefinition) => {
                return ts.createShorthandPropertyAssignment(next.name.value)
              })
            )
          ]
        )
      ),
      // args.write(output)
      createMethodCallStatement(
        COMMON_IDENTIFIERS.args,
        'write',
        [ COMMON_IDENTIFIERS.output ]
      ),
      // output.writeMessageEnd()
      createMethodCallStatement(
        COMMON_IDENTIFIERS.output,
        'writeMessageEnd'
      ),
      ts.createReturn(
        ts.createCall(
          ts.createPropertyAccess(
            createConnectionSend(),
            ts.createIdentifier('then'),
          ),
          undefined,
          [
            ts.createArrowFunction(
              undefined,
              undefined,
              [
                createFunctionParameter(
                  COMMON_IDENTIFIERS.data,
                  ts.createTypeReferenceNode(
                    COMMON_IDENTIFIERS.Buffer,
                    undefined,
                  )
                )
              ],
              undefined,
              undefined,
              ts.createBlock([
                createConstStatement(
                  COMMON_IDENTIFIERS.reader,
                  ts.createTypeReferenceNode(
                    COMMON_IDENTIFIERS.TTransport,
                    undefined,
                  ),
                  ts.createCall(
                    ts.createIdentifier('this.transport.receiver'),
                    undefined,
                    [
                      COMMON_IDENTIFIERS.data,
                    ],
                  )
                ),
                createConstStatement(
                  COMMON_IDENTIFIERS.input,
                  ts.createTypeReferenceNode(
                    COMMON_IDENTIFIERS.TProtocol,
                    undefined,
                  ),
                  ts.createNew(
                    ts.createIdentifier('this.protocol'),
                    undefined,
                    [
                      COMMON_IDENTIFIERS.reader
                    ],
                  )
                ),
                ts.createTry(
                  ts.createBlock([
                    ts.createVariableStatement(
                      undefined,
                      ts.createVariableDeclarationList([
                        ts.createVariableDeclaration(
                          ts.createObjectBindingPattern([
                            ts.createBindingElement(
                              undefined,
                              COMMON_IDENTIFIERS.fieldName,
                              COMMON_IDENTIFIERS.fieldName,
                            ),
                            ts.createBindingElement(
                              undefined,
                              COMMON_IDENTIFIERS.messageType,
                              COMMON_IDENTIFIERS.messageType,
                            )
                          ]),
                          ts.createTypeReferenceNode(
                            COMMON_IDENTIFIERS.IThriftMessage,
                            undefined,
                          ),
                          ts.createCall(
                            ts.createPropertyAccess(
                              COMMON_IDENTIFIERS.input,
                              'readMessageBegin'
                            ),
                            undefined,
                            [],
                          )
                        )
                      ], ts.NodeFlags.Const)
                    ),
                    ts.createIf(
                      ts.createBinary(
                        COMMON_IDENTIFIERS.fieldName,
                        ts.SyntaxKind.EqualsEqualsEqualsToken,
                        ts.createLiteral(def.name.value),
                      ),
                      ts.createBlock([
                        // if (messageType === Thrift.MessageType.EXCEPTION) {
                        //     const x = new Thrift.TApplicationException()
                        //     x.read(proto)
                        //     proto.readMessageEnd()
                        //     return callback(x)
                        // }
                        createExceptionHandler(),

                        // const result = new {{ServiceName}}{{nameTitleCase}}Result()
                        ...createNewResultInstance(def),

                        // proto.readMessageEnd()
                        createMethodCallStatement(
                          COMMON_IDENTIFIERS.input,
                          'readMessageEnd'
                        ),

                        // {{#throws}}if (result.{{throwName}} != null) {
                        //     return callback(result.{{throwName}})
                        // }
                        ...def.throws.map((next: FieldDefinition): ts.IfStatement => {
                          return ts.createIf(
                            createNotNull(`result.${next.name.value}`),
                            ts.createBlock([
                              ts.createReturn(
                                rejectPromiseWith(ts.createIdentifier(`result.${next.name.value}`))
                              )
                            ], true)
                          )
                        }),
                        createResultHandler(def)
                      ], true),
                      ts.createBlock([
                        ts.createReturn(
                          rejectPromiseWith(
                            ts.createNew(
                              COMMON_IDENTIFIERS.TApplicationException,
                              undefined,
                              [
                                APPLICATION_EXCEPTION.WRONG_METHOD_NAME,
                                ts.createBinary(
                                  ts.createLiteral(
                                    "Received a response to an unknown RPC function: ",
                                  ),
                                  ts.SyntaxKind.PlusToken,
                                  COMMON_IDENTIFIERS.fieldName
                                )
                              ]
                            )
                          )
                        )
                      ], true),
                    )
                  ], true),
                  ts.createCatchClause(
                    ts.createVariableDeclaration(
                      COMMON_IDENTIFIERS.err,
                    ),
                    ts.createBlock([
                      ts.createReturn(
                        rejectPromiseWith(
                          COMMON_IDENTIFIERS.err,
                        )
                      ),
                    ], true),
                  ),
                  undefined,
                )
              ], true)
            )
          ],
        )
      ),
    ], true) // body
  )
}

function createConnectionSend(): ts.CallExpression {
  return ts.createCall(
    ts.createIdentifier('this.connection.send'),
    undefined,
    [
      ts.createCall(
        ts.createPropertyAccess(
          COMMON_IDENTIFIERS.writer,
          'flush'
        ),
        undefined,
        [],
      ),
      COMMON_IDENTIFIERS.context,
    ]
  )
}

// const result = new {{ServiceName}}{{nameTitleCase}}Result()
function createNewResultInstance(def: FunctionDefinition): Array<ts.Statement> {
  return [
    createConstStatement(
      ts.createIdentifier('result'),
      ts.createTypeReferenceNode(
        ts.createIdentifier(createStructResultName(def)),
        undefined
      ),
      ts.createCall(
        ts.createPropertyAccess(
          ts.createIdentifier(createStructResultName(def)),
          ts.createIdentifier('read')
        ),
        undefined,
        [
          COMMON_IDENTIFIERS.input
        ],
      )
    ),
  ]
}

function createExceptionHandler(): ts.Statement {
  return ts.createIf(
    ts.createBinary(
      COMMON_IDENTIFIERS.messageType,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      MESSAGE_TYPE.EXCEPTION
    ),
    ts.createBlock([
      createConstStatement(
        COMMON_IDENTIFIERS.err,
        ts.createTypeReferenceNode(COMMON_IDENTIFIERS.TApplicationException, undefined),
        ts.createCall(
          ts.createPropertyAccess(
            COMMON_IDENTIFIERS.TApplicationException,
            ts.createIdentifier('read')
          ),
          undefined,
          [
            COMMON_IDENTIFIERS.input
          ],
        )
      ),
      createMethodCallStatement(
        COMMON_IDENTIFIERS.input,
        'readMessageEnd'
      ),
      ts.createReturn(
        rejectPromiseWith(COMMON_IDENTIFIERS.err)
      )
    ], true)
  )
}

function resolvePromiseWith(result: ts.Expression): ts.CallExpression {
  return ts.createCall(
    ts.createPropertyAccess(
      COMMON_IDENTIFIERS.Promise,
      'resolve',
    ),
    undefined,
    [ result ]
  )
}

function rejectPromiseWith(result: ts.Expression): ts.CallExpression {
  return ts.createCall(
    ts.createPropertyAccess(
      COMMON_IDENTIFIERS.Promise,
      'reject',
    ),
    undefined,
    [ result ]
  )
}

function createResultHandler(def: FunctionDefinition): ts.Statement {

  if (def.returnType.type === SyntaxType.VoidKeyword) {
    return ts.createReturn(
      resolvePromiseWith(ts.createIdentifier('result.success'))
    )
  } else {
    // {{^isVoid}}
    // if (result.success != null) {
    //     return callback(undefined, result.success)
    // }
    // {{/isVoid}}
    return ts.createIf(
      createNotNull(
        ts.createIdentifier('result.success')
      ),
      ts.createBlock([
        ts.createReturn(
          resolvePromiseWith(ts.createIdentifier('result.success'))
        )
      ], true),
      ts.createBlock([
        // return callback(new Thrift.TApplicationException(Thrift.TApplicationExceptionType.UNKNOWN, "{{name}} failed: unknown result"))
        ts.createReturn(
          rejectPromiseWith(
            createApplicationException(
              'UNKNOWN',
              `${def.name.value} failed: unknown result`
            )
          )
        )
      ], true)
    )
  }
}

function createParametersForField(field: FieldDefinition): ts.ParameterDeclaration {
  return createFunctionParameter(
    field.name.value,
    typeNodeForFieldType(field.fieldType)
  )
}
