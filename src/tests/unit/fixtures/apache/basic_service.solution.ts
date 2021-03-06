export namespace MyService {
    export interface IPingArgsArgs {
    }
    export class PingArgs implements thrift.TStructLike {
        constructor(args?: IPingArgsArgs) {
            if (args != null) {
            }
        }
        public write(output: thrift.TProtocol): void {
            output.writeStructBegin("PingArgs");
            output.writeFieldStop();
            output.writeStructEnd();
            return;
        }
        public read(input: thrift.TProtocol): void {
            input.readStructBegin();
            while (true) {
                const ret: {
                    fname: string;
                    ftype: thrift.Thrift.Type;
                    fid: number;
                } = input.readFieldBegin();
                const ftype: thrift.Thrift.Type = ret.ftype;
                const fid: number = ret.fid;
                if (ftype === thrift.Thrift.Type.STOP) {
                    break;
                }
                switch (fid) {
                    default: {
                        input.skip(ftype);
                    }
                }
                input.readFieldEnd();
            }
            input.readStructEnd();
            return;
        }
    }
    export interface IPingResultArgs {
        success?: void;
    }
    export class PingResult implements thrift.TStructLike {
        public success: void;
        constructor(args?: IPingResultArgs) {
            if (args != null) {
                if (args.success != null) {
                    this.success = args.success;
                }
            }
        }
        public write(output: thrift.TProtocol): void {
            output.writeStructBegin("PingResult");
            output.writeFieldStop();
            output.writeStructEnd();
            return;
        }
        public read(input: thrift.TProtocol): void {
            input.readStructBegin();
            while (true) {
                const ret: {
                    fname: string;
                    ftype: thrift.Thrift.Type;
                    fid: number;
                } = input.readFieldBegin();
                const ftype: thrift.Thrift.Type = ret.ftype;
                const fid: number = ret.fid;
                if (ftype === thrift.Thrift.Type.STOP) {
                    break;
                }
                switch (fid) {
                    case 0:
                        if (ftype === thrift.Thrift.Type.VOID) {
                            input.skip(ftype);
                        }
                        else {
                            input.skip(ftype);
                        }
                        break;
                    default: {
                        input.skip(ftype);
                    }
                }
                input.readFieldEnd();
            }
            input.readStructEnd();
            return;
        }
    }
    export class Client {
        public _seqid: number;
        public _reqs: {
            [name: number]: (err: Error | object | undefined, val?: any) => void;
        };
        public output: thrift.TTransport;
        public protocol: new (trans: thrift.TTransport) => thrift.TProtocol;
        constructor(output: thrift.TTransport, protocol: new (trans: thrift.TTransport) => thrift.TProtocol) {
            this._seqid = 0;
            this._reqs = {};
            this.output = output;
            this.protocol = protocol;
        }
        public incrementSeqId(): number {
            return this._seqid += 1;
        }
        public ping(): Promise<void> {
            const requestId: number = this.incrementSeqId();
            return new Promise<void>((resolve, reject): void => {
                this._reqs[requestId] = (error, result) => {
                    delete this._reqs[requestId];
                    if (error != null) {
                        reject(error);
                    }
                    else {
                        resolve(result);
                    }
                };
                this.send_ping(requestId);
            });
        }
        public send_ping(requestId: number): void {
            const output: thrift.TProtocol = new this.protocol(this.output);
            output.writeMessageBegin("ping", thrift.Thrift.MessageType.CALL, requestId);
            const args: PingArgs = new PingArgs({});
            args.write(output);
            output.writeMessageEnd();
            return this.output.flush();
        }
        public recv_ping(input: thrift.TProtocol, mtype: thrift.Thrift.MessageType, rseqid: number): void {
            const noop = (): any => null;
            const callback = this._reqs[rseqid] || noop;
            if (mtype === thrift.Thrift.MessageType.EXCEPTION) {
                const x: thrift.Thrift.TApplicationException = new thrift.Thrift.TApplicationException();
                x.read(input);
                input.readMessageEnd();
                return callback(x);
            }
            const result: PingResult = new PingResult();
            result.read(input);
            input.readMessageEnd();
            return callback(undefined);
        }
    }
    export interface IHandler<Context = any> {
        ping: (context?: Context) => void | Promise<void>;
    }
    export class Processor<Context = any> {
        public _handler: IHandler<Context>;
        constructor(handler: IHandler<Context>) {
            this._handler = handler;
        }
        public process(input: thrift.TProtocol, output: thrift.TProtocol, context?: Context): void {
            const metadata: {
                fname: string;
                mtype: thrift.Thrift.MessageType;
                rseqid: number;
            } = input.readMessageBegin();
            const fname: string = metadata.fname;
            const rseqid: number = metadata.rseqid;
            const methodName: string = "process_" + fname;
            switch (methodName) {
                case "process_ping": {
                    return this.process_ping(rseqid, input, output, context);
                }
                default: {
                    input.skip(thrift.Thrift.Type.STRUCT);
                    input.readMessageEnd();
                    const errMessage = "Unknown function " + fname;
                    const err = new thrift.Thrift.TApplicationException(thrift.Thrift.TApplicationExceptionType.UNKNOWN_METHOD, errMessage);
                    output.writeMessageBegin(fname, thrift.Thrift.MessageType.EXCEPTION, rseqid);
                    err.write(output);
                    output.writeMessageEnd();
                    output.flush();
                }
            }
        }
        public process_ping(seqid: number, input: thrift.TProtocol, output: thrift.TProtocol, context?: Context): void {
            const args = new PingArgs();
            args.read(input);
            input.readMessageEnd();
            new Promise<void>((resolve, reject): void => {
                try {
                    resolve(this._handler.ping(context));
                }
                catch (err) {
                    reject(err);
                }
            }).then((data: void): void => {
                const result: PingResult = new PingResult({ success: data });
                output.writeMessageBegin("ping", thrift.Thrift.MessageType.REPLY, seqid);
                result.write(output);
                output.writeMessageEnd();
                output.flush();
            }).catch((err: Error): void => {
                const result: thrift.Thrift.TApplicationException = new thrift.Thrift.TApplicationException(thrift.Thrift.TApplicationExceptionType.UNKNOWN, err.message);
                output.writeMessageBegin("ping", thrift.Thrift.MessageType.EXCEPTION, seqid);
                result.write(output);
                output.writeMessageEnd();
                output.flush();
                return;
            });
        }
    }
}
