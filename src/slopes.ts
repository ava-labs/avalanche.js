/**
 * @module SlopesCore
 */
import { APIBase, RequestResponseData } from './utils/types';
import axios from 'axios';
import { AxiosRequestConfig, AxiosResponse, Method } from "axios";

/**
 * SlopesCore is middleware for interacting with AVA node RPC APIs. 
 * 
 * Example usage:
 * ```js
 * let slopes = new SlopesCore("127.0.0.1", 9650, "https");
 * ```
 * 
 */
export default class SlopesCore {
    protected networkID:number = 2;
    protected protocol:string;
    protected ip:string;
    protected port:number;
    protected url:string;
    protected apis:{ [k: string]: APIBase } = {};

    /**
     * Sets the address and port of the main AVA Client.
     * 
     * @param ip The hostname to resolve to reach the AVA Client RPC APIs
     * @param port The port to resolve to reach the AVA Client RPC APIs
     * @param protocol The protocol string to use before a "://" in a request, ex: "http", "https", "git", "ws", etc ...
     */
    setAddress = (ip:string, port:number, protocol:string = "http") => {
            this.ip = ip;
            this.port = port;
            this.protocol = protocol;
            this.url = protocol+'://'+ip+':'+port;
    }

    /**
     * Returns the protocol such as "http", "https", "git", "ws", etc.
     */
    getProtocol = ():string => {
        return this.protocol;
    }

    /**
     * Returns the IP for the AVA node.
     */
    getIP = ():string => {
        return this.ip;
    }

    /**
     * Returns the port for the AVA node.
     */
    getPort = ():number => {
        return this.port;
    }

    /**
     * Returns the URL of the AVA node (ip + port);
     */
    getURL = ():string => {
        return this.url;
    }
    
    /**
     * Returns the networkID;
     */
    getNetworkID = ():number => {
        return this.networkID;
    }

    /**
     * Sets the networkID
     */
    setNetworkID = (netid:number) => {
        this.networkID = netid;
    }

    /**
     * Adds an API to the middleware. The API resolves to a registered blockchain's RPC. 
     * 
     * In TypeScript:
     * ```js
     * slopes.addAPI<MyVMClass>("mychain", MyVMClass, "/ext/bc/mychain");
     * ```
     * 
     * In Javascript:
     * ```js
     * slopes.addAPI("mychain", MyVMClass, "/ext/bc/mychain");
     * ```
     * 
     * @typeparam GA Class of the API being added
     * @param apiName A label for referencing the API in the future
     * @param constructorFN A reference to the class which instantiates the API
     * @param baseurl Path to resolve to reach the API
     * 
     */
    addAPI = <GA extends APIBase>(apiName:string, constructorFN: new(ava:SlopesCore, baseurl?:string, ...args:Array<any>) => GA, baseurl:string = undefined, ...args:Array<any>) => {
        if(baseurl == undefined) {
            this.apis[apiName] = new constructorFN(this, undefined, ...args);
        } else {
            this.apis[apiName] = new constructorFN(this, baseurl, ...args);
        }
    }

    /**
     * Retrieves a reference to an API by its apiName label.
     * 
     * @param apiName Name of the API to return
     */
    api = <GA extends APIBase>(apiName:string): GA => {
        return this.apis[apiName] as GA;
    }

    /**
     * @ignore
     */
    protected _request = async (xhrmethod:Method, baseurl:string, getdata:object, postdata:string | object | ArrayBuffer | ArrayBufferView, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> => {

        let config:AxiosRequestConfig;
        if(axiosConfig){
            config = axiosConfig;
        } else {
            config = {
                baseURL:this.protocol+"://"+this.ip+":"+this.port,
                responseType: 'text'
            };
        }
        config.url = baseurl;
        config.method = xhrmethod;
        config.headers = headers;
        config.data = postdata;
        config.params = getdata;
        return axios.request(config).then((resp:AxiosResponse<any>) => {
            //purging all that is axios
            let xhrdata:RequestResponseData = new RequestResponseData();
            xhrdata.data = resp.data;
            xhrdata.headers = resp.headers;
            xhrdata.request = resp.request;
            xhrdata.status = resp.status;
            xhrdata.statusText = resp.statusText;
            return xhrdata;
        });
    }

    /**
     * Makes a GET call to an API.
     * 
     * @param baseurl Path to the api
     * @param getdata Object containing the key value pairs sent in GET
     * @param parameters Object containing the parameters of the API call
     * @param headers An array HTTP Request Headers
     * @param axiosConfig Configuration for the axios javascript library that will be the foundation for the rest of the parameters
     * 
     * @returns A promise for [[RequestResponseData]]
     */
    get = (baseurl:string, getdata:object, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> =>{
        return this._request("GET", baseurl, getdata, {}, headers, axiosConfig);
    }

    /**
     * Makes a DELETE call to an API.
     * 
     * @param baseurl Path to the API
     * @param getdata Object containing the key value pairs sent in DELETE
     * @param parameters Object containing the parameters of the API call
     * @param headers An array HTTP Request Headers
     * @param axiosConfig Configuration for the axios javascript library that will be the foundation for the rest of the parameters
     * 
     * @returns A promise for [[RequestResponseData]]
     */
    delete = (baseurl:string, getdata:object, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> => {
        return this._request("DELETE", baseurl, getdata, {}, headers, axiosConfig);
    }

    /**
     * Makes a POST call to an API.
     * 
     * @param baseurl Path to the API
     * @param getdata Object containing the key value pairs sent in POST
     * @param postdata Object containing the key value pairs sent in POST
     * @param parameters Object containing the parameters of the API call
     * @param headers An array HTTP Request Headers
     * @param axiosConfig Configuration for the axios javascript library that will be the foundation for the rest of the parameters
     * 
     * @returns A promise for [[RequestResponseData]]
     */
    post = (baseurl:string, getdata:object, postdata:string | object | ArrayBuffer | ArrayBufferView, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> => {
        return this._request("POST", baseurl, getdata, postdata, headers, axiosConfig);
    }

    /**
     * Makes a PUT call to an API.
     * 
     * @param baseurl Path to the baseurl
     * @param getdata Object containing the key value pairs sent in PUT
     * @param postdata Object containing the key value pairs sent in PUT
     * @param parameters Object containing the parameters of the API call
     * @param headers An array HTTP Request Headers
     * @param axiosConfig Configuration for the axios javascript library that will be the foundation for the rest of the parameters
     * 
     * @returns A promise for [[RequestResponseData]]
     */
    put = (baseurl:string, getdata:object, postdata:string | object | ArrayBuffer | ArrayBufferView, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> => {
        return this._request("PUT", baseurl, getdata, postdata, headers, axiosConfig);
    }

    /**
     * Makes a PATCH call to an API.
     * 
     * @param baseurl Path to the baseurl
     * @param getdata Object containing the key value pairs sent in PATCH
     * @param postdata Object containing the key value pairs sent in PATCH
     * @param parameters Object containing the parameters of the API call
     * @param headers An array HTTP Request Headers
     * @param axiosConfig Configuration for the axios javascript library that will be the foundation for the rest of the parameters
     * 
     * @returns A promise for [[RequestResponseData]]
     */
    patch = (baseurl:string, getdata:object, postdata:string | object | ArrayBuffer | ArrayBufferView, headers:object = {}, axiosConfig:AxiosRequestConfig = undefined): Promise<RequestResponseData> => {
        return this._request("PATCH", baseurl, getdata, postdata, headers, axiosConfig);
    }
    
    /**
     * Creates a new Slopes instance. Sets the address and port of the main AVA Client.
     * 
     * @param ip The hostname to resolve to reach the AVA Client APIs
     * @param port The port to resolve to reach the AVA Client APIs
     * @param protocol The protocol string to use before a "://" in a request, ex: "http", "https", "git", "ws", etc ...
     */
    constructor(ip:string, port:number, protocol:string = "http"){
        this.setAddress(ip, port, protocol);
    }
}