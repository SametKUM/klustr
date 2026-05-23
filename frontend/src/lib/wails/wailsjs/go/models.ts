export namespace kube {
	
	export class ConditionDetail {
	    type: string;
	    status: string;
	    reason: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ConditionDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.status = source["status"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	    }
	}
	export class APIServiceDetail {
	    name: string;
	    uid: string;
	    group: string;
	    version: string;
	    service: string;
	    groupPriorityMinimum: number;
	    versionPriority: number;
	    insecureSkipTLSVerify: boolean;
	    hasCABundle: boolean;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new APIServiceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.service = source["service"];
	        this.groupPriorityMinimum = source["groupPriorityMinimum"];
	        this.versionPriority = source["versionPriority"];
	        this.insecureSkipTLSVerify = source["insecureSkipTLSVerify"];
	        this.hasCABundle = source["hasCABundle"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class APIServiceInfo {
	    name: string;
	    group: string;
	    version: string;
	    service: string;
	    available: string;
	    message: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new APIServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.service = source["service"];
	        this.available = source["available"];
	        this.message = source["message"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class AccessSubject {
	    kind: string;
	    name: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new AccessSubject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	    }
	}
	export class ArgoApplicationInfo {
	    name: string;
	    namespace: string;
	    sync: string;
	    health: string;
	    revision: string;
	    project: string;
	    repoURL: string;
	    path: string;
	    targetRevision: string;
	    autoSync: boolean;
	    selfHeal: boolean;
	    prune: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.sync = source["sync"];
	        this.health = source["health"];
	        this.revision = source["revision"];
	        this.project = source["project"];
	        this.repoURL = source["repoURL"];
	        this.path = source["path"];
	        this.targetRevision = source["targetRevision"];
	        this.autoSync = source["autoSync"];
	        this.selfHeal = source["selfHeal"];
	        this.prune = source["prune"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ArgoApplicationResource {
	    group: string;
	    version: string;
	    kind: string;
	    namespace: string;
	    name: string;
	    sync: string;
	    health: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationResource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.sync = source["sync"];
	        this.health = source["health"];
	        this.message = source["message"];
	    }
	}
	export class BackendRefDetail {
	    group: string;
	    kind: string;
	    namespace: string;
	    name: string;
	    port: number;
	    weight: number;
	
	    static createFrom(source: any = {}) {
	        return new BackendRefDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.port = source["port"];
	        this.weight = source["weight"];
	    }
	}
	export class PrinterColumn {
	    name: string;
	    type: string;
	    jsonPath: string;
	
	    static createFrom(source: any = {}) {
	        return new PrinterColumn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.jsonPath = source["jsonPath"];
	    }
	}
	export class CRDInfo {
	    kind: string;
	    group: string;
	    version: string;
	    resource: string;
	    singular: string;
	    shortNames: string[];
	    scope: string;
	    createdAt: string;
	    printerColumns: PrinterColumn[];
	
	    static createFrom(source: any = {}) {
	        return new CRDInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.group = source["group"];
	        this.version = source["version"];
	        this.resource = source["resource"];
	        this.singular = source["singular"];
	        this.shortNames = source["shortNames"];
	        this.scope = source["scope"];
	        this.createdAt = source["createdAt"];
	        this.printerColumns = this.convertValues(source["printerColumns"], PrinterColumn);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CSIDriverDetail {
	    name: string;
	    uid: string;
	    attachRequired: boolean;
	    podInfoOnMount: boolean;
	    storageCapacity: boolean;
	    requiresRepublish: boolean;
	    seLinuxMount: boolean;
	    fsGroupPolicy: string;
	    volumeLifecycleModes: string[];
	    tokenRequests: string[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CSIDriverDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.attachRequired = source["attachRequired"];
	        this.podInfoOnMount = source["podInfoOnMount"];
	        this.storageCapacity = source["storageCapacity"];
	        this.requiresRepublish = source["requiresRepublish"];
	        this.seLinuxMount = source["seLinuxMount"];
	        this.fsGroupPolicy = source["fsGroupPolicy"];
	        this.volumeLifecycleModes = source["volumeLifecycleModes"];
	        this.tokenRequests = source["tokenRequests"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CSIDriverInfo {
	    name: string;
	    attachRequired: boolean;
	    podInfoOnMount: boolean;
	    modes: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CSIDriverInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.attachRequired = source["attachRequired"];
	        this.podInfoOnMount = source["podInfoOnMount"];
	        this.modes = source["modes"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CSINodeDriverDetail {
	    name: string;
	    nodeID: string;
	    topologyKeys: string[];
	    allocatableMax: number;
	
	    static createFrom(source: any = {}) {
	        return new CSINodeDriverDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.nodeID = source["nodeID"];
	        this.topologyKeys = source["topologyKeys"];
	        this.allocatableMax = source["allocatableMax"];
	    }
	}
	export class CSINodeDetail {
	    name: string;
	    uid: string;
	    drivers: CSINodeDriverDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CSINodeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.drivers = this.convertValues(source["drivers"], CSINodeDriverDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class CSINodeInfo {
	    name: string;
	    drivers: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CSINodeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.drivers = source["drivers"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CertificateSigningRequestDetail {
	    name: string;
	    uid: string;
	    signerName: string;
	    requester: string;
	    requesterUID: string;
	    groups: string[];
	    usages: string[];
	    expirationSeconds: number;
	    condition: string;
	    issued: boolean;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertificateSigningRequestDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.signerName = source["signerName"];
	        this.requester = source["requester"];
	        this.requesterUID = source["requesterUID"];
	        this.groups = source["groups"];
	        this.usages = source["usages"];
	        this.expirationSeconds = source["expirationSeconds"];
	        this.condition = source["condition"];
	        this.issued = source["issued"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CertificateSigningRequestInfo {
	    name: string;
	    signerName: string;
	    requester: string;
	    condition: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertificateSigningRequestInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.signerName = source["signerName"];
	        this.requester = source["requester"];
	        this.condition = source["condition"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ClusterPods {
	    usage: number;
	    allocatable: number;
	    capacity: number;
	
	    static createFrom(source: any = {}) {
	        return new ClusterPods(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.usage = source["usage"];
	        this.allocatable = source["allocatable"];
	        this.capacity = source["capacity"];
	    }
	}
	export class ClusterResource {
	    usage: number;
	    requests: number;
	    limits: number;
	    allocatable: number;
	    capacity: number;
	
	    static createFrom(source: any = {}) {
	        return new ClusterResource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.usage = source["usage"];
	        this.requests = source["requests"];
	        this.limits = source["limits"];
	        this.allocatable = source["allocatable"];
	        this.capacity = source["capacity"];
	    }
	}
	export class ClusterOverview {
	    cpu: ClusterResource;
	    memory: ClusterResource;
	    pods: ClusterPods;
	    nodeCount: number;
	    namespaceCount: number;
	    metricsAvailable: boolean;
	    metricsError?: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterOverview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpu = this.convertValues(source["cpu"], ClusterResource);
	        this.memory = this.convertValues(source["memory"], ClusterResource);
	        this.pods = this.convertValues(source["pods"], ClusterPods);
	        this.nodeCount = source["nodeCount"];
	        this.namespaceCount = source["namespaceCount"];
	        this.metricsAvailable = source["metricsAvailable"];
	        this.metricsError = source["metricsError"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class SubjectDetail {
	    kind: string;
	    name: string;
	    namespace: string;
	    apiGroup: string;
	
	    static createFrom(source: any = {}) {
	        return new SubjectDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.apiGroup = source["apiGroup"];
	    }
	}
	export class RoleRefDetail {
	    kind: string;
	    name: string;
	    apiGroup: string;
	
	    static createFrom(source: any = {}) {
	        return new RoleRefDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.apiGroup = source["apiGroup"];
	    }
	}
	export class ClusterRoleBindingDetail {
	    name: string;
	    uid: string;
	    roleRef: RoleRefDetail;
	    subjects: SubjectDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterRoleBindingDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.roleRef = this.convertValues(source["roleRef"], RoleRefDetail);
	        this.subjects = this.convertValues(source["subjects"], SubjectDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ClusterRoleBindingInfo {
	    name: string;
	    roleRef: string;
	    subjects: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterRoleBindingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.roleRef = source["roleRef"];
	        this.subjects = source["subjects"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PolicyRuleDetail {
	    verbs: string[];
	    apiGroups: string[];
	    resources: string[];
	    resourceNames: string[];
	    nonResourceURLs: string[];
	
	    static createFrom(source: any = {}) {
	        return new PolicyRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.verbs = source["verbs"];
	        this.apiGroups = source["apiGroups"];
	        this.resources = source["resources"];
	        this.resourceNames = source["resourceNames"];
	        this.nonResourceURLs = source["nonResourceURLs"];
	    }
	}
	export class ClusterRoleDetail {
	    name: string;
	    uid: string;
	    rules: PolicyRuleDetail[];
	    aggregationLabel: Record<string, string>;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterRoleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.rules = this.convertValues(source["rules"], PolicyRuleDetail);
	        this.aggregationLabel = source["aggregationLabel"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ClusterRoleInfo {
	    name: string;
	    rules: number;
	    aggregation: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ClusterRoleInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.rules = source["rules"];
	        this.aggregation = source["aggregation"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class ConfigMapDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    data: Record<string, string>;
	    binaryKeys: string[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigMapDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.data = source["data"];
	        this.binaryKeys = source["binaryKeys"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ConfigMapInfo {
	    name: string;
	    namespace: string;
	    keys: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigMapInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.keys = source["keys"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ContainerEnvFrom {
	    source: string;
	    prefix: string;
	    ref?: EnvVarRef;
	
	    static createFrom(source: any = {}) {
	        return new ContainerEnvFrom(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.prefix = source["prefix"];
	        this.ref = this.convertValues(source["ref"], EnvVarRef);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EnvVarRef {
	    kind: string;
	    name: string;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new EnvVarRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.key = source["key"];
	    }
	}
	export class ContainerEnvVar {
	    name: string;
	    value: string;
	    valueFrom: string;
	    ref?: EnvVarRef;
	
	    static createFrom(source: any = {}) {
	        return new ContainerEnvVar(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.valueFrom = source["valueFrom"];
	        this.ref = this.convertValues(source["ref"], EnvVarRef);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContainerPort {
	    name: string;
	    containerPort: number;
	    protocol: string;
	
	    static createFrom(source: any = {}) {
	        return new ContainerPort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.containerPort = source["containerPort"];
	        this.protocol = source["protocol"];
	    }
	}
	export class ContainerDetail {
	    name: string;
	    image: string;
	    state: string;
	    stateReason: string;
	    ready: boolean;
	    restartCount: number;
	    startedAt: string;
	    lastState: string;
	    ports: ContainerPort[];
	    env: ContainerEnvVar[];
	    envFrom: ContainerEnvFrom[];
	
	    static createFrom(source: any = {}) {
	        return new ContainerDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.image = source["image"];
	        this.state = source["state"];
	        this.stateReason = source["stateReason"];
	        this.ready = source["ready"];
	        this.restartCount = source["restartCount"];
	        this.startedAt = source["startedAt"];
	        this.lastState = source["lastState"];
	        this.ports = this.convertValues(source["ports"], ContainerPort);
	        this.env = this.convertValues(source["env"], ContainerEnvVar);
	        this.envFrom = this.convertValues(source["envFrom"], ContainerEnvFrom);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class ContainerSummary {
	    name: string;
	    image: string;
	    ports: string[];
	    command: string[];
	    args: string[];
	    envCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ContainerSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.image = source["image"];
	        this.ports = source["ports"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.envCount = source["envCount"];
	    }
	}
	export class ContextInfo {
	    name: string;
	    cluster: string;
	    server: string;
	    user: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cluster = source["cluster"];
	        this.server = source["server"];
	        this.user = source["user"];
	        this.namespace = source["namespace"];
	    }
	}
	export class CronJobDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    schedule: string;
	    timeZone: string;
	    suspend: boolean;
	    concurrencyPolicy: string;
	    startingDeadlineSeconds: number;
	    successfulJobsHistoryLimit: number;
	    failedJobsHistoryLimit: number;
	    active: number;
	    lastSchedule: string;
	    containers: ContainerSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CronJobDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.schedule = source["schedule"];
	        this.timeZone = source["timeZone"];
	        this.suspend = source["suspend"];
	        this.concurrencyPolicy = source["concurrencyPolicy"];
	        this.startingDeadlineSeconds = source["startingDeadlineSeconds"];
	        this.successfulJobsHistoryLimit = source["successfulJobsHistoryLimit"];
	        this.failedJobsHistoryLimit = source["failedJobsHistoryLimit"];
	        this.active = source["active"];
	        this.lastSchedule = source["lastSchedule"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CronJobInfo {
	    name: string;
	    namespace: string;
	    schedule: string;
	    suspend: boolean;
	    active: number;
	    lastSchedule: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CronJobInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.schedule = source["schedule"];
	        this.suspend = source["suspend"];
	        this.active = source["active"];
	        this.lastSchedule = source["lastSchedule"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CustomResourceInfo {
	    name: string;
	    namespace: string;
	    createdAt: string;
	    cells: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new CustomResourceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.createdAt = source["createdAt"];
	        this.cells = source["cells"];
	    }
	}
	export class DaemonSetDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    desired: number;
	    current: number;
	    ready: number;
	    upToDate: number;
	    available: number;
	    misscheduled: number;
	    nodeSelector: Record<string, string>;
	    updateStrategy: string;
	    selector: Record<string, string>;
	    containers: ContainerSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.upToDate = source["upToDate"];
	        this.available = source["available"];
	        this.misscheduled = source["misscheduled"];
	        this.nodeSelector = source["nodeSelector"];
	        this.updateStrategy = source["updateStrategy"];
	        this.selector = source["selector"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DaemonSetInfo {
	    name: string;
	    namespace: string;
	    desired: number;
	    current: number;
	    ready: number;
	    upToDate: number;
	    available: number;
	    nodeSelector: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.upToDate = source["upToDate"];
	        this.available = source["available"];
	        this.nodeSelector = source["nodeSelector"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class DeploymentDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    strategy: string;
	    replicas: number;
	    ready: number;
	    updated: number;
	    available: number;
	    unavailable: number;
	    paused: boolean;
	    selector: Record<string, string>;
	    containers: ContainerSummary[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.strategy = source["strategy"];
	        this.replicas = source["replicas"];
	        this.ready = source["ready"];
	        this.updated = source["updated"];
	        this.available = source["available"];
	        this.unavailable = source["unavailable"];
	        this.paused = source["paused"];
	        this.selector = source["selector"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DeploymentInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    upToDate: number;
	    available: number;
	    strategy: string;
	    images: string;
	    paused: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.upToDate = source["upToDate"];
	        this.available = source["available"];
	        this.strategy = source["strategy"];
	        this.images = source["images"];
	        this.paused = source["paused"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class EndpointSlicePort {
	    name: string;
	    port: number;
	    protocol: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointSlicePort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.port = source["port"];
	        this.protocol = source["protocol"];
	    }
	}
	export class EndpointSliceEndpoint {
	    addresses: string[];
	    nodeName: string;
	    hostname: string;
	    ready: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EndpointSliceEndpoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.addresses = source["addresses"];
	        this.nodeName = source["nodeName"];
	        this.hostname = source["hostname"];
	        this.ready = source["ready"];
	    }
	}
	export class EndpointSliceDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    addressType: string;
	    service: string;
	    endpoints: EndpointSliceEndpoint[];
	    ports: EndpointSlicePort[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointSliceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.addressType = source["addressType"];
	        this.service = source["service"];
	        this.endpoints = this.convertValues(source["endpoints"], EndpointSliceEndpoint);
	        this.ports = this.convertValues(source["ports"], EndpointSlicePort);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class EndpointSliceInfo {
	    name: string;
	    namespace: string;
	    addressType: string;
	    ports: string;
	    endpoints: number;
	    service: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointSliceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.addressType = source["addressType"];
	        this.ports = source["ports"];
	        this.endpoints = source["endpoints"];
	        this.service = source["service"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class EndpointsSubsetPort {
	    name: string;
	    port: number;
	    protocol: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointsSubsetPort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.port = source["port"];
	        this.protocol = source["protocol"];
	    }
	}
	export class EndpointsSubsetAddress {
	    ip: string;
	    hostname: string;
	    nodeName: string;
	    ready: boolean;
	
	    static createFrom(source: any = {}) {
	        return new EndpointsSubsetAddress(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ip = source["ip"];
	        this.hostname = source["hostname"];
	        this.nodeName = source["nodeName"];
	        this.ready = source["ready"];
	    }
	}
	export class EndpointsSubset {
	    addresses: EndpointsSubsetAddress[];
	    ports: EndpointsSubsetPort[];
	
	    static createFrom(source: any = {}) {
	        return new EndpointsSubset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.addresses = this.convertValues(source["addresses"], EndpointsSubsetAddress);
	        this.ports = this.convertValues(source["ports"], EndpointsSubsetPort);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EndpointsDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    subsets: EndpointsSubset[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointsDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.subsets = this.convertValues(source["subsets"], EndpointsSubset);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EndpointsInfo {
	    name: string;
	    namespace: string;
	    endpoints: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new EndpointsInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.endpoints = source["endpoints"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	
	
	export class EventInfo {
	    namespace: string;
	    name: string;
	    type: string;
	    reason: string;
	    message: string;
	    count: number;
	    source: string;
	    // Go type: time
	    firstSeen: any;
	    // Go type: time
	    lastSeen: any;
	    objectKind: string;
	    objectName: string;
	
	    static createFrom(source: any = {}) {
	        return new EventInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.count = source["count"];
	        this.source = source["source"];
	        this.firstSeen = this.convertValues(source["firstSeen"], null);
	        this.lastSeen = this.convertValues(source["lastSeen"], null);
	        this.objectKind = source["objectKind"];
	        this.objectName = source["objectName"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RouteParentStatusDetail {
	    parent: ParentRefDetail;
	    controller: string;
	    conditions: ConditionDetail[];
	
	    static createFrom(source: any = {}) {
	        return new RouteParentStatusDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.parent = this.convertValues(source["parent"], ParentRefDetail);
	        this.controller = source["controller"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GRPCRouteMatchDetail {
	    methodType: string;
	    service: string;
	    method: string;
	    headers: string[];
	
	    static createFrom(source: any = {}) {
	        return new GRPCRouteMatchDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.methodType = source["methodType"];
	        this.service = source["service"];
	        this.method = source["method"];
	        this.headers = source["headers"];
	    }
	}
	export class GRPCRouteRuleDetail {
	    matches: GRPCRouteMatchDetail[];
	    backends: BackendRefDetail[];
	
	    static createFrom(source: any = {}) {
	        return new GRPCRouteRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.matches = this.convertValues(source["matches"], GRPCRouteMatchDetail);
	        this.backends = this.convertValues(source["backends"], BackendRefDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ParentRefDetail {
	    group: string;
	    kind: string;
	    namespace: string;
	    name: string;
	    sectionName: string;
	    port: number;
	
	    static createFrom(source: any = {}) {
	        return new ParentRefDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.sectionName = source["sectionName"];
	        this.port = source["port"];
	    }
	}
	export class GRPCRouteDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    hostnames: string[];
	    parents: ParentRefDetail[];
	    rules: GRPCRouteRuleDetail[];
	    status: RouteParentStatusDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GRPCRouteDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.hostnames = source["hostnames"];
	        this.parents = this.convertValues(source["parents"], ParentRefDetail);
	        this.rules = this.convertValues(source["rules"], GRPCRouteRuleDetail);
	        this.status = this.convertValues(source["status"], RouteParentStatusDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GRPCRouteInfo {
	    name: string;
	    namespace: string;
	    hostnames: string;
	    parents: string;
	    rules: number;
	    accepted: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GRPCRouteInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.hostnames = source["hostnames"];
	        this.parents = source["parents"];
	        this.rules = source["rules"];
	        this.accepted = source["accepted"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	export class GatewayClassDetail {
	    name: string;
	    uid: string;
	    controller: string;
	    description: string;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GatewayClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.controller = source["controller"];
	        this.description = source["description"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GatewayClassInfo {
	    name: string;
	    controller: string;
	    accepted: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GatewayClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.controller = source["controller"];
	        this.accepted = source["accepted"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ListenerDetail {
	    name: string;
	    hostname: string;
	    protocol: string;
	    port: number;
	    allowedNamespaces: string;
	    attachedRoutes: number;
	    conditions: ConditionDetail[];
	
	    static createFrom(source: any = {}) {
	        return new ListenerDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.hostname = source["hostname"];
	        this.protocol = source["protocol"];
	        this.port = source["port"];
	        this.allowedNamespaces = source["allowedNamespaces"];
	        this.attachedRoutes = source["attachedRoutes"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GatewayDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    class: string;
	    addresses: string[];
	    listeners: ListenerDetail[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GatewayDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.class = source["class"];
	        this.addresses = source["addresses"];
	        this.listeners = this.convertValues(source["listeners"], ListenerDetail);
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GatewayInfo {
	    name: string;
	    namespace: string;
	    class: string;
	    addresses: string;
	    listeners: string;
	    programmed: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GatewayInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.class = source["class"];
	        this.addresses = source["addresses"];
	        this.listeners = source["listeners"];
	        this.programmed = source["programmed"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class HPAMetricTarget {
	    name: string;
	    current: number;
	    target: number;
	    text: string;
	
	    static createFrom(source: any = {}) {
	        return new HPAMetricTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	        this.target = source["target"];
	        this.text = source["text"];
	    }
	}
	export class HTTPRouteMatchDetail {
	    pathType: string;
	    path: string;
	    method: string;
	    headers: string[];
	    queryParams: string[];
	
	    static createFrom(source: any = {}) {
	        return new HTTPRouteMatchDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pathType = source["pathType"];
	        this.path = source["path"];
	        this.method = source["method"];
	        this.headers = source["headers"];
	        this.queryParams = source["queryParams"];
	    }
	}
	export class HTTPRouteRuleDetail {
	    matches: HTTPRouteMatchDetail[];
	    backends: BackendRefDetail[];
	
	    static createFrom(source: any = {}) {
	        return new HTTPRouteRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.matches = this.convertValues(source["matches"], HTTPRouteMatchDetail);
	        this.backends = this.convertValues(source["backends"], BackendRefDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPRouteDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    hostnames: string[];
	    parents: ParentRefDetail[];
	    rules: HTTPRouteRuleDetail[];
	    status: RouteParentStatusDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HTTPRouteDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.hostnames = source["hostnames"];
	        this.parents = this.convertValues(source["parents"], ParentRefDetail);
	        this.rules = this.convertValues(source["rules"], HTTPRouteRuleDetail);
	        this.status = this.convertValues(source["status"], RouteParentStatusDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HTTPRouteInfo {
	    name: string;
	    namespace: string;
	    hostnames: string;
	    parents: string;
	    rules: number;
	    accepted: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HTTPRouteInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.hostnames = source["hostnames"];
	        this.parents = source["parents"];
	        this.rules = source["rules"];
	        this.accepted = source["accepted"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	export class HelmChartSearchResult {
	    repo: string;
	    name: string;
	    version: string;
	    appVersion: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmChartSearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repo = source["repo"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.appVersion = source["appVersion"];
	        this.description = source["description"];
	    }
	}
	export class HelmDryRunResult {
	    manifest: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmDryRunResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = source["manifest"];
	        this.notes = source["notes"];
	    }
	}
	export class HelmInstallOptions {
	    contextName: string;
	    namespace: string;
	    releaseName: string;
	    chartRef: string;
	    chartVersion: string;
	    values: string;
	    createNamespace: boolean;
	    wait: boolean;
	    atomic: boolean;
	    timeoutSeconds: number;
	    dryRun: boolean;
	    resetValues: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HelmInstallOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contextName = source["contextName"];
	        this.namespace = source["namespace"];
	        this.releaseName = source["releaseName"];
	        this.chartRef = source["chartRef"];
	        this.chartVersion = source["chartVersion"];
	        this.values = source["values"];
	        this.createNamespace = source["createNamespace"];
	        this.wait = source["wait"];
	        this.atomic = source["atomic"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	        this.dryRun = source["dryRun"];
	        this.resetValues = source["resetValues"];
	    }
	}
	export class HelmRevisionInfo {
	    revision: number;
	    status: string;
	    updated: string;
	    chart: string;
	    appVersion: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmRevisionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.revision = source["revision"];
	        this.status = source["status"];
	        this.updated = source["updated"];
	        this.chart = source["chart"];
	        this.appVersion = source["appVersion"];
	        this.description = source["description"];
	    }
	}
	export class HelmReleaseInfo {
	    name: string;
	    namespace: string;
	    revision: number;
	    status: string;
	    chart: string;
	    chartName: string;
	    chartVersion: string;
	    appVersion: string;
	    updated: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.revision = source["revision"];
	        this.status = source["status"];
	        this.chart = source["chart"];
	        this.chartName = source["chartName"];
	        this.chartVersion = source["chartVersion"];
	        this.appVersion = source["appVersion"];
	        this.updated = source["updated"];
	        this.description = source["description"];
	    }
	}
	export class HelmReleaseDetail {
	    info: HelmReleaseInfo;
	    notes: string;
	    manifest: string;
	    userValues: string;
	    mergedValues: string;
	    chartName: string;
	    chartVersion: string;
	    appVersion: string;
	    revisions: HelmRevisionInfo[];
	
	    static createFrom(source: any = {}) {
	        return new HelmReleaseDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.info = this.convertValues(source["info"], HelmReleaseInfo);
	        this.notes = source["notes"];
	        this.manifest = source["manifest"];
	        this.userValues = source["userValues"];
	        this.mergedValues = source["mergedValues"];
	        this.chartName = source["chartName"];
	        this.chartVersion = source["chartVersion"];
	        this.appVersion = source["appVersion"];
	        this.revisions = this.convertValues(source["revisions"], HelmRevisionInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class HelmRepoInfo {
	    name: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmRepoInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	    }
	}
	
	export class HorizontalPodAutoscalerDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    reference: string;
	    minReplicas: number;
	    maxReplicas: number;
	    currentReplicas: number;
	    desiredReplicas: number;
	    metrics: HPAMetricTarget[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HorizontalPodAutoscalerDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.reference = source["reference"];
	        this.minReplicas = source["minReplicas"];
	        this.maxReplicas = source["maxReplicas"];
	        this.currentReplicas = source["currentReplicas"];
	        this.desiredReplicas = source["desiredReplicas"];
	        this.metrics = this.convertValues(source["metrics"], HPAMetricTarget);
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HorizontalPodAutoscalerInfo {
	    name: string;
	    namespace: string;
	    reference: string;
	    minReplicas: number;
	    maxReplicas: number;
	    currentReplicas: number;
	    metrics: HPAMetricTarget[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HorizontalPodAutoscalerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.reference = source["reference"];
	        this.minReplicas = source["minReplicas"];
	        this.maxReplicas = source["maxReplicas"];
	        this.currentReplicas = source["currentReplicas"];
	        this.metrics = this.convertValues(source["metrics"], HPAMetricTarget);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IngressClassDetail {
	    name: string;
	    uid: string;
	    controller: string;
	    isDefault: boolean;
	    parameters: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.controller = source["controller"];
	        this.isDefault = source["isDefault"];
	        this.parameters = source["parameters"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class IngressClassInfo {
	    name: string;
	    controller: string;
	    isDefault: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.controller = source["controller"];
	        this.isDefault = source["isDefault"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class IngressTLSDetail {
	    hosts: string[];
	    secretName: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressTLSDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hosts = source["hosts"];
	        this.secretName = source["secretName"];
	    }
	}
	export class IngressPathDetail {
	    path: string;
	    pathType: string;
	    serviceName: string;
	    servicePort: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressPathDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.pathType = source["pathType"];
	        this.serviceName = source["serviceName"];
	        this.servicePort = source["servicePort"];
	    }
	}
	export class IngressRuleDetail {
	    host: string;
	    paths: IngressPathDetail[];
	
	    static createFrom(source: any = {}) {
	        return new IngressRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.paths = this.convertValues(source["paths"], IngressPathDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IngressDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    class: string;
	    rules: IngressRuleDetail[];
	    tls: IngressTLSDetail[];
	    addresses: string[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.class = source["class"];
	        this.rules = this.convertValues(source["rules"], IngressRuleDetail);
	        this.tls = this.convertValues(source["tls"], IngressTLSDetail);
	        this.addresses = source["addresses"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IngressInfo {
	    name: string;
	    namespace: string;
	    class: string;
	    hosts: string;
	    address: string;
	    ports: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.class = source["class"];
	        this.hosts = source["hosts"];
	        this.address = source["address"];
	        this.ports = source["ports"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	
	export class JobDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    completions: string;
	    parallelism: number;
	    backoffLimit: number;
	    active: number;
	    succeeded: number;
	    failed: number;
	    startTime: string;
	    completionTime: string;
	    duration: string;
	    status: string;
	    containers: ContainerSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new JobDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.completions = source["completions"];
	        this.parallelism = source["parallelism"];
	        this.backoffLimit = source["backoffLimit"];
	        this.active = source["active"];
	        this.succeeded = source["succeeded"];
	        this.failed = source["failed"];
	        this.startTime = source["startTime"];
	        this.completionTime = source["completionTime"];
	        this.duration = source["duration"];
	        this.status = source["status"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class JobInfo {
	    name: string;
	    namespace: string;
	    completions: string;
	    duration: string;
	    status: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new JobInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.completions = source["completions"];
	        this.duration = source["duration"];
	        this.status = source["status"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class Kubeconfig {
	    contexts: ContextInfo[];
	    currentContext: string;
	
	    static createFrom(source: any = {}) {
	        return new Kubeconfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.contexts = this.convertValues(source["contexts"], ContextInfo);
	        this.currentContext = source["currentContext"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LeaseDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    holderIdentity: string;
	    leaseDurationSeconds: number;
	    acquireTime: string;
	    renewTime: string;
	    leaseTransitions: number;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new LeaseDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.holderIdentity = source["holderIdentity"];
	        this.leaseDurationSeconds = source["leaseDurationSeconds"];
	        this.acquireTime = source["acquireTime"];
	        this.renewTime = source["renewTime"];
	        this.leaseTransitions = source["leaseTransitions"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class LeaseInfo {
	    name: string;
	    namespace: string;
	    holder: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new LeaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.holder = source["holder"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class LimitRangeItem {
	    type: string;
	    max: Record<string, string>;
	    min: Record<string, string>;
	    default: Record<string, string>;
	    defaultRequest: Record<string, string>;
	    maxLimitRequestRatio: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new LimitRangeItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.max = source["max"];
	        this.min = source["min"];
	        this.default = source["default"];
	        this.defaultRequest = source["defaultRequest"];
	        this.maxLimitRequestRatio = source["maxLimitRequestRatio"];
	    }
	}
	export class LimitRangeDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    limits: LimitRangeItem[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new LimitRangeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.limits = this.convertValues(source["limits"], LimitRangeItem);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class LimitRangeInfo {
	    name: string;
	    namespace: string;
	    limits: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new LimitRangeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.limits = source["limits"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	export class NamespaceDetail {
	    name: string;
	    uid: string;
	    phase: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NamespaceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.phase = source["phase"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class NamespaceInfo {
	    name: string;
	    phase: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NamespaceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.phase = source["phase"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class NetworkPolicyDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    podSelector: string;
	    policyTypes: string[];
	    ingress: number;
	    egress: number;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NetworkPolicyDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.podSelector = source["podSelector"];
	        this.policyTypes = source["policyTypes"];
	        this.ingress = source["ingress"];
	        this.egress = source["egress"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class NetworkPolicyInfo {
	    name: string;
	    namespace: string;
	    podSelector: string;
	    policyTypes: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NetworkPolicyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.podSelector = source["podSelector"];
	        this.policyTypes = source["policyTypes"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class NodeTaintDetail {
	    key: string;
	    value: string;
	    effect: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeTaintDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.effect = source["effect"];
	    }
	}
	export class NodeDetail {
	    name: string;
	    uid: string;
	    status: string;
	    roles: string;
	    version: string;
	    osImage: string;
	    kernelVersion: string;
	    containerRuntime: string;
	    architecture: string;
	    internalIP: string;
	    hostname: string;
	    capacity: Record<string, string>;
	    allocatable: Record<string, string>;
	    taints: NodeTaintDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    conditions: ConditionDetail[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.status = source["status"];
	        this.roles = source["roles"];
	        this.version = source["version"];
	        this.osImage = source["osImage"];
	        this.kernelVersion = source["kernelVersion"];
	        this.containerRuntime = source["containerRuntime"];
	        this.architecture = source["architecture"];
	        this.internalIP = source["internalIP"];
	        this.hostname = source["hostname"];
	        this.capacity = source["capacity"];
	        this.allocatable = source["allocatable"];
	        this.taints = this.convertValues(source["taints"], NodeTaintDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NodeInfo {
	    name: string;
	    status: string;
	    roles: string;
	    version: string;
	    osImage: string;
	    internalIP: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.status = source["status"];
	        this.roles = source["roles"];
	        this.version = source["version"];
	        this.osImage = source["osImage"];
	        this.internalIP = source["internalIP"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class ObjectRefDetail {
	    kind: string;
	    namespace: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new ObjectRefDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	    }
	}
	export class OwnerRef {
	    kind: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new OwnerRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	    }
	}
	
	export class PersistentVolumeClaimDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    status: string;
	    volume: string;
	    storageClass: string;
	    volumeMode: string;
	    accessModes: string[];
	    capacity: string;
	    request: string;
	    selector: Record<string, string>;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeClaimDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.status = source["status"];
	        this.volume = source["volume"];
	        this.storageClass = source["storageClass"];
	        this.volumeMode = source["volumeMode"];
	        this.accessModes = source["accessModes"];
	        this.capacity = source["capacity"];
	        this.request = source["request"];
	        this.selector = source["selector"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PersistentVolumeClaimInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    volume: string;
	    capacity: string;
	    accessModes: string;
	    storageClass: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeClaimInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.volume = source["volume"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.storageClass = source["storageClass"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PersistentVolumeDetail {
	    name: string;
	    uid: string;
	    status: string;
	    capacity: string;
	    accessModes: string[];
	    reclaimPolicy: string;
	    storageClass: string;
	    volumeMode: string;
	    claim: string;
	    source: string;
	    message: string;
	    reason: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.status = source["status"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.reclaimPolicy = source["reclaimPolicy"];
	        this.storageClass = source["storageClass"];
	        this.volumeMode = source["volumeMode"];
	        this.claim = source["claim"];
	        this.source = source["source"];
	        this.message = source["message"];
	        this.reason = source["reason"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PersistentVolumeInfo {
	    name: string;
	    capacity: string;
	    accessModes: string;
	    reclaimPolicy: string;
	    status: string;
	    claim: string;
	    storageClass: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.reclaimPolicy = source["reclaimPolicy"];
	        this.status = source["status"];
	        this.claim = source["claim"];
	        this.storageClass = source["storageClass"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PodDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    status: string;
	    phase: string;
	    node: string;
	    podIP: string;
	    hostIP: string;
	    qosClass: string;
	    serviceAccount: string;
	    restartPolicy: string;
	    priorityClassName: string;
	    createdAt: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    owners: OwnerRef[];
	    initContainers: ContainerDetail[];
	    containers: ContainerDetail[];
	    conditions: ConditionDetail[];
	
	    static createFrom(source: any = {}) {
	        return new PodDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.status = source["status"];
	        this.phase = source["phase"];
	        this.node = source["node"];
	        this.podIP = source["podIP"];
	        this.hostIP = source["hostIP"];
	        this.qosClass = source["qosClass"];
	        this.serviceAccount = source["serviceAccount"];
	        this.restartPolicy = source["restartPolicy"];
	        this.priorityClassName = source["priorityClassName"];
	        this.createdAt = source["createdAt"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.owners = this.convertValues(source["owners"], OwnerRef);
	        this.initContainers = this.convertValues(source["initContainers"], ContainerDetail);
	        this.containers = this.convertValues(source["containers"], ContainerDetail);
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodDisruptionBudgetDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    minAvailable: string;
	    maxUnavailable: string;
	    selector: string;
	    currentHealthy: number;
	    desiredHealthy: number;
	    expectedPods: number;
	    disruptionsAllowed: number;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PodDisruptionBudgetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.minAvailable = source["minAvailable"];
	        this.maxUnavailable = source["maxUnavailable"];
	        this.selector = source["selector"];
	        this.currentHealthy = source["currentHealthy"];
	        this.desiredHealthy = source["desiredHealthy"];
	        this.expectedPods = source["expectedPods"];
	        this.disruptionsAllowed = source["disruptionsAllowed"];
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodDisruptionBudgetInfo {
	    name: string;
	    namespace: string;
	    minAvailable: string;
	    maxUnavailable: string;
	    currentHealthy: number;
	    desiredHealthy: number;
	    allowed: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PodDisruptionBudgetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.minAvailable = source["minAvailable"];
	        this.maxUnavailable = source["maxUnavailable"];
	        this.currentHealthy = source["currentHealthy"];
	        this.desiredHealthy = source["desiredHealthy"];
	        this.allowed = source["allowed"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PodInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    ready: string;
	    restarts: number;
	    node: string;
	    podIP: string;
	    createdAt: string;
	    cpuRequestMC: number;
	    cpuLimitMC: number;
	    memRequestB: number;
	    memLimitB: number;
	    hasPorts: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PodInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.ready = source["ready"];
	        this.restarts = source["restarts"];
	        this.node = source["node"];
	        this.podIP = source["podIP"];
	        this.createdAt = source["createdAt"];
	        this.cpuRequestMC = source["cpuRequestMC"];
	        this.cpuLimitMC = source["cpuLimitMC"];
	        this.memRequestB = source["memRequestB"];
	        this.memLimitB = source["memLimitB"];
	        this.hasPorts = source["hasPorts"];
	    }
	}
	export class PodLogTarget {
	    pod: string;
	    containers: string[];
	
	    static createFrom(source: any = {}) {
	        return new PodLogTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pod = source["pod"];
	        this.containers = source["containers"];
	    }
	}
	export class PodMetrics {
	    namespace: string;
	    name: string;
	    cpuMC: number;
	    memB: number;
	
	    static createFrom(source: any = {}) {
	        return new PodMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.cpuMC = source["cpuMC"];
	        this.memB = source["memB"];
	    }
	}
	
	export class PortForwardInfo {
	    id: string;
	    context: string;
	    namespace: string;
	    podName: string;
	    localPort: number;
	    remotePort: number;
	    status: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new PortForwardInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.context = source["context"];
	        this.namespace = source["namespace"];
	        this.podName = source["podName"];
	        this.localPort = source["localPort"];
	        this.remotePort = source["remotePort"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}
	
	export class PriorityClassDetail {
	    name: string;
	    uid: string;
	    value: number;
	    globalDefault: boolean;
	    description: string;
	    preemptionPolicy: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PriorityClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.value = source["value"];
	        this.globalDefault = source["globalDefault"];
	        this.description = source["description"];
	        this.preemptionPolicy = source["preemptionPolicy"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class PriorityClassInfo {
	    name: string;
	    value: number;
	    globalDefault: boolean;
	    description: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PriorityClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.value = source["value"];
	        this.globalDefault = source["globalDefault"];
	        this.description = source["description"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ReferenceGrantToDetail {
	    group: string;
	    kind: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new ReferenceGrantToDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	    }
	}
	export class ReferenceGrantFromDetail {
	    group: string;
	    kind: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new ReferenceGrantFromDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	    }
	}
	export class ReferenceGrantDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    from: ReferenceGrantFromDetail[];
	    to: ReferenceGrantToDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReferenceGrantDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.from = this.convertValues(source["from"], ReferenceGrantFromDetail);
	        this.to = this.convertValues(source["to"], ReferenceGrantToDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ReferenceGrantInfo {
	    name: string;
	    namespace: string;
	    from: string;
	    to: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReferenceGrantInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.from = source["from"];
	        this.to = source["to"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class ReplicaSetDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    desired: number;
	    current: number;
	    ready: number;
	    available: number;
	    owners: OwnerRef[];
	    selector: Record<string, string>;
	    containers: ContainerSummary[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplicaSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.available = source["available"];
	        this.owners = this.convertValues(source["owners"], OwnerRef);
	        this.selector = source["selector"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.conditions = this.convertValues(source["conditions"], ConditionDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReplicaSetInfo {
	    name: string;
	    namespace: string;
	    desired: number;
	    current: number;
	    ready: number;
	    ownedBy: string;
	    images: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplicaSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.ownedBy = source["ownedBy"];
	        this.images = source["images"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ReplicationControllerDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    desired: number;
	    current: number;
	    ready: number;
	    available: number;
	    selector: Record<string, string>;
	    containers: ContainerSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplicationControllerDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.available = source["available"];
	        this.selector = source["selector"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ReplicationControllerInfo {
	    name: string;
	    namespace: string;
	    desired: number;
	    current: number;
	    ready: number;
	    images: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplicationControllerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.ready = source["ready"];
	        this.images = source["images"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ResourceQuotaEntry {
	    resource: string;
	    used: string;
	    hard: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceQuotaEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.resource = source["resource"];
	        this.used = source["used"];
	        this.hard = source["hard"];
	    }
	}
	export class ResourceQuotaDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    scopes: string[];
	    entries: ResourceQuotaEntry[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceQuotaDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.scopes = source["scopes"];
	        this.entries = this.convertValues(source["entries"], ResourceQuotaEntry);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ResourceQuotaInfo {
	    name: string;
	    namespace: string;
	    scopes: string;
	    used: number;
	    hard: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceQuotaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.scopes = source["scopes"];
	        this.used = source["used"];
	        this.hard = source["hard"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class RoleBindingDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    roleRef: RoleRefDetail;
	    subjects: SubjectDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RoleBindingDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.roleRef = this.convertValues(source["roleRef"], RoleRefDetail);
	        this.subjects = this.convertValues(source["subjects"], SubjectDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RoleBindingInfo {
	    name: string;
	    namespace: string;
	    roleRef: string;
	    subjects: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RoleBindingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.roleRef = source["roleRef"];
	        this.subjects = source["subjects"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class RoleDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    rules: PolicyRuleDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RoleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.rules = this.convertValues(source["rules"], PolicyRuleDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RoleInfo {
	    name: string;
	    namespace: string;
	    rules: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RoleInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.rules = source["rules"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	export class RuntimeClassDetail {
	    name: string;
	    uid: string;
	    handler: string;
	    overhead: Record<string, string>;
	    scheduling: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RuntimeClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.handler = source["handler"];
	        this.overhead = source["overhead"];
	        this.scheduling = source["scheduling"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class RuntimeClassInfo {
	    name: string;
	    handler: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RuntimeClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.handler = source["handler"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class SecretKeyInfo {
	    key: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new SecretKeyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.size = source["size"];
	    }
	}
	export class SecretDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    type: string;
	    keys: SecretKeyInfo[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SecretDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.type = source["type"];
	        this.keys = this.convertValues(source["keys"], SecretKeyInfo);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SecretInfo {
	    name: string;
	    namespace: string;
	    type: string;
	    keys: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SecretInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.type = source["type"];
	        this.keys = source["keys"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class ServerVersion {
	    gitVersion: string;
	    platform: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerVersion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gitVersion = source["gitVersion"];
	        this.platform = source["platform"];
	    }
	}
	export class ServiceAccountDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    automountServiceAccountToken: string;
	    secrets: ObjectRefDetail[];
	    imagePullSecrets: ObjectRefDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceAccountDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.automountServiceAccountToken = source["automountServiceAccountToken"];
	        this.secrets = this.convertValues(source["secrets"], ObjectRefDetail);
	        this.imagePullSecrets = this.convertValues(source["imagePullSecrets"], ObjectRefDetail);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceAccountInfo {
	    name: string;
	    namespace: string;
	    secrets: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceAccountInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.secrets = source["secrets"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ServicePortDetail {
	    name: string;
	    protocol: string;
	    port: number;
	    targetPort: string;
	    nodePort: number;
	
	    static createFrom(source: any = {}) {
	        return new ServicePortDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.protocol = source["protocol"];
	        this.port = source["port"];
	        this.targetPort = source["targetPort"];
	        this.nodePort = source["nodePort"];
	    }
	}
	export class ServiceDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    type: string;
	    clusterIPs: string[];
	    externalIPs: string[];
	    selector: Record<string, string>;
	    ports: ServicePortDetail[];
	    sessionAffinity: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.type = source["type"];
	        this.clusterIPs = source["clusterIPs"];
	        this.externalIPs = source["externalIPs"];
	        this.selector = source["selector"];
	        this.ports = this.convertValues(source["ports"], ServicePortDetail);
	        this.sessionAffinity = source["sessionAffinity"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ServiceInfo {
	    name: string;
	    namespace: string;
	    type: string;
	    clusterIP: string;
	    externalIP: string;
	    ports: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.type = source["type"];
	        this.clusterIP = source["clusterIP"];
	        this.externalIP = source["externalIP"];
	        this.ports = source["ports"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class StatefulSetDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    replicas: number;
	    ready: number;
	    service: string;
	    updateStrategy: string;
	    podManagementPolicy: string;
	    selector: Record<string, string>;
	    containers: ContainerSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new StatefulSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.replicas = source["replicas"];
	        this.ready = source["ready"];
	        this.service = source["service"];
	        this.updateStrategy = source["updateStrategy"];
	        this.podManagementPolicy = source["podManagementPolicy"];
	        this.selector = source["selector"];
	        this.containers = this.convertValues(source["containers"], ContainerSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StatefulSetInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    service: string;
	    images: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new StatefulSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.service = source["service"];
	        this.images = source["images"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class StorageClassDetail {
	    name: string;
	    uid: string;
	    provisioner: string;
	    reclaimPolicy: string;
	    volumeBindingMode: string;
	    allowExpansion: boolean;
	    isDefault: boolean;
	    parameters: Record<string, string>;
	    mountOptions: string[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new StorageClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.provisioner = source["provisioner"];
	        this.reclaimPolicy = source["reclaimPolicy"];
	        this.volumeBindingMode = source["volumeBindingMode"];
	        this.allowExpansion = source["allowExpansion"];
	        this.isDefault = source["isDefault"];
	        this.parameters = source["parameters"];
	        this.mountOptions = source["mountOptions"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class StorageClassInfo {
	    name: string;
	    provisioner: string;
	    reclaimPolicy: string;
	    volumeBindingMode: string;
	    allowExpansion: boolean;
	    isDefault: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new StorageClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.provisioner = source["provisioner"];
	        this.reclaimPolicy = source["reclaimPolicy"];
	        this.volumeBindingMode = source["volumeBindingMode"];
	        this.allowExpansion = source["allowExpansion"];
	        this.isDefault = source["isDefault"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class SubjectAccessRule {
	    apiGroups: string[];
	    resources: string[];
	    verbs: string[];
	    resourceNames: string[];
	    nonResourceURLs: string[];
	    bindingKind: string;
	    bindingName: string;
	    bindingNamespace: string;
	    roleKind: string;
	    roleName: string;
	    roleNamespace: string;
	    scope: string;
	    viaGroup: string;
	
	    static createFrom(source: any = {}) {
	        return new SubjectAccessRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiGroups = source["apiGroups"];
	        this.resources = source["resources"];
	        this.verbs = source["verbs"];
	        this.resourceNames = source["resourceNames"];
	        this.nonResourceURLs = source["nonResourceURLs"];
	        this.bindingKind = source["bindingKind"];
	        this.bindingName = source["bindingName"];
	        this.bindingNamespace = source["bindingNamespace"];
	        this.roleKind = source["roleKind"];
	        this.roleName = source["roleName"];
	        this.roleNamespace = source["roleNamespace"];
	        this.scope = source["scope"];
	        this.viaGroup = source["viaGroup"];
	    }
	}
	export class SubjectAccess {
	    subject: AccessSubject;
	    rules: SubjectAccessRule[];
	    hasWildcard: boolean;
	    clusterAdmin: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SubjectAccess(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subject = this.convertValues(source["subject"], AccessSubject);
	        this.rules = this.convertValues(source["rules"], SubjectAccessRule);
	        this.hasWildcard = source["hasWildcard"];
	        this.clusterAdmin = source["clusterAdmin"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class VolumeAttachmentDetail {
	    name: string;
	    uid: string;
	    attacher: string;
	    node: string;
	    pv: string;
	    attached: boolean;
	    attachError: string;
	    detachError: string;
	    attachMetadata: Record<string, string>;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new VolumeAttachmentDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.attacher = source["attacher"];
	        this.node = source["node"];
	        this.pv = source["pv"];
	        this.attached = source["attached"];
	        this.attachError = source["attachError"];
	        this.detachError = source["detachError"];
	        this.attachMetadata = source["attachMetadata"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class VolumeAttachmentInfo {
	    name: string;
	    attacher: string;
	    node: string;
	    pv: string;
	    attached: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new VolumeAttachmentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.attacher = source["attacher"];
	        this.node = source["node"];
	        this.pv = source["pv"];
	        this.attached = source["attached"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class WebhookSummary {
	    name: string;
	    clientCfg: string;
	    failPolicy: string;
	    sideEffects: string;
	    operations: string[];
	    resources: string[];
	
	    static createFrom(source: any = {}) {
	        return new WebhookSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.clientCfg = source["clientCfg"];
	        this.failPolicy = source["failPolicy"];
	        this.sideEffects = source["sideEffects"];
	        this.operations = source["operations"];
	        this.resources = source["resources"];
	    }
	}
	export class WebhookConfigurationDetail {
	    name: string;
	    uid: string;
	    webhooks: WebhookSummary[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new WebhookConfigurationDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.webhooks = this.convertValues(source["webhooks"], WebhookSummary);
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WebhookConfigurationInfo {
	    name: string;
	    webhooks: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new WebhookConfigurationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.webhooks = source["webhooks"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class WorkloadRevision {
	    revision: number;
	    createdAt: string;
	    changeCause: string;
	    active: boolean;
	    images: string[];
	
	    static createFrom(source: any = {}) {
	        return new WorkloadRevision(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.revision = source["revision"];
	        this.createdAt = source["createdAt"];
	        this.changeCause = source["changeCause"];
	        this.active = source["active"];
	        this.images = source["images"];
	    }
	}

}

