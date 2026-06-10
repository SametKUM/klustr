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
	export class AdmissionPolicyAuditAnnotation {
	    key: string;
	    valueExpression: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyAuditAnnotation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.valueExpression = source["valueExpression"];
	    }
	}
	export class AdmissionPolicyMatchCondition {
	    name: string;
	    expression: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyMatchCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.expression = source["expression"];
	    }
	}
	export class AdmissionPolicyBindingDetail {
	    name: string;
	    uid: string;
	    policyName: string;
	    paramRef: string;
	    validationActions: string[];
	    matchResources: string[];
	    matchConditions: AdmissionPolicyMatchCondition[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyBindingDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.policyName = source["policyName"];
	        this.paramRef = source["paramRef"];
	        this.validationActions = source["validationActions"];
	        this.matchResources = source["matchResources"];
	        this.matchConditions = this.convertValues(source["matchConditions"], AdmissionPolicyMatchCondition);
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
	export class AdmissionPolicyBindingInfo {
	    name: string;
	    policyName: string;
	    paramRef: string;
	    actions: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyBindingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.policyName = source["policyName"];
	        this.paramRef = source["paramRef"];
	        this.actions = source["actions"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class AdmissionPolicyVariable {
	    name: string;
	    expression: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyVariable(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.expression = source["expression"];
	    }
	}
	export class AdmissionPolicyMutation {
	    name: string;
	    patchType: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyMutation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.patchType = source["patchType"];
	        this.description = source["description"];
	    }
	}
	export class AdmissionPolicyValidation {
	    expression: string;
	    message: string;
	    reason: string;
	    messageExpression: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyValidation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.expression = source["expression"];
	        this.message = source["message"];
	        this.reason = source["reason"];
	        this.messageExpression = source["messageExpression"];
	    }
	}
	export class AdmissionPolicyDetail {
	    name: string;
	    uid: string;
	    failPolicy: string;
	    paramKind: string;
	    matchResources: string[];
	    validations: AdmissionPolicyValidation[];
	    mutations: AdmissionPolicyMutation[];
	    auditAnnotations: AdmissionPolicyAuditAnnotation[];
	    matchConditions: AdmissionPolicyMatchCondition[];
	    variables: AdmissionPolicyVariable[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.failPolicy = source["failPolicy"];
	        this.paramKind = source["paramKind"];
	        this.matchResources = source["matchResources"];
	        this.validations = this.convertValues(source["validations"], AdmissionPolicyValidation);
	        this.mutations = this.convertValues(source["mutations"], AdmissionPolicyMutation);
	        this.auditAnnotations = this.convertValues(source["auditAnnotations"], AdmissionPolicyAuditAnnotation);
	        this.matchConditions = this.convertValues(source["matchConditions"], AdmissionPolicyMatchCondition);
	        this.variables = this.convertValues(source["variables"], AdmissionPolicyVariable);
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
	export class AdmissionPolicyInfo {
	    name: string;
	    failPolicy: string;
	    paramKind: string;
	    validations: number;
	    mutations: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new AdmissionPolicyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.failPolicy = source["failPolicy"];
	        this.paramKind = source["paramKind"];
	        this.validations = source["validations"];
	        this.mutations = source["mutations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	
	
	export class AllocatedDeviceDetail {
	    request: string;
	    driver: string;
	    pool: string;
	    device: string;
	
	    static createFrom(source: any = {}) {
	        return new AllocatedDeviceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.request = source["request"];
	        this.driver = source["driver"];
	        this.pool = source["pool"];
	        this.device = source["device"];
	    }
	}
	export class ArgoAppProjectDestination {
	    server: string;
	    namespace: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectDestination(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = source["server"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	    }
	}
	export class ArgoAppProjectSyncWindow {
	    kind: string;
	    schedule: string;
	    duration: string;
	    applications: string[];
	    namespaces: string[];
	    clusters: string[];
	    manualSync: boolean;
	    timeZone: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectSyncWindow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.schedule = source["schedule"];
	        this.duration = source["duration"];
	        this.applications = source["applications"];
	        this.namespaces = source["namespaces"];
	        this.clusters = source["clusters"];
	        this.manualSync = source["manualSync"];
	        this.timeZone = source["timeZone"];
	    }
	}
	export class ArgoAppProjectRole {
	    name: string;
	    description: string;
	    policies: string[];
	    groups: string[];
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectRole(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.policies = source["policies"];
	        this.groups = source["groups"];
	    }
	}
	export class ArgoAppProjectGroupKind {
	    group: string;
	    kind: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectGroupKind(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	    }
	}
	export class ArgoAppProjectDetail {
	    name: string;
	    namespace: string;
	    description: string;
	    sourceRepos: string[];
	    sourceNamespaces: string[];
	    destinations: ArgoAppProjectDestination[];
	    clusterResourceWhitelist: ArgoAppProjectGroupKind[];
	    namespaceResourceWhitelist: ArgoAppProjectGroupKind[];
	    clusterResourceBlacklist: ArgoAppProjectGroupKind[];
	    namespaceResourceBlacklist: ArgoAppProjectGroupKind[];
	    roles: ArgoAppProjectRole[];
	    syncWindows: ArgoAppProjectSyncWindow[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.description = source["description"];
	        this.sourceRepos = source["sourceRepos"];
	        this.sourceNamespaces = source["sourceNamespaces"];
	        this.destinations = this.convertValues(source["destinations"], ArgoAppProjectDestination);
	        this.clusterResourceWhitelist = this.convertValues(source["clusterResourceWhitelist"], ArgoAppProjectGroupKind);
	        this.namespaceResourceWhitelist = this.convertValues(source["namespaceResourceWhitelist"], ArgoAppProjectGroupKind);
	        this.clusterResourceBlacklist = this.convertValues(source["clusterResourceBlacklist"], ArgoAppProjectGroupKind);
	        this.namespaceResourceBlacklist = this.convertValues(source["namespaceResourceBlacklist"], ArgoAppProjectGroupKind);
	        this.roles = this.convertValues(source["roles"], ArgoAppProjectRole);
	        this.syncWindows = this.convertValues(source["syncWindows"], ArgoAppProjectSyncWindow);
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
	
	export class ArgoAppProjectInfo {
	    name: string;
	    namespace: string;
	    description: string;
	    sourceRepoCount: number;
	    destinationCount: number;
	    roleCount: number;
	    syncWindowCount: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoAppProjectInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.description = source["description"];
	        this.sourceRepoCount = source["sourceRepoCount"];
	        this.destinationCount = source["destinationCount"];
	        this.roleCount = source["roleCount"];
	        this.syncWindowCount = source["syncWindowCount"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	
	export class ArgoApplicationHistoryEntry {
	    id: number;
	    revision: string;
	    deployedAt: string;
	    deployStartedAt: string;
	    repoURL: string;
	    path: string;
	    targetRevision: string;
	    initiatedBy: string;
	    automated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationHistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.revision = source["revision"];
	        this.deployedAt = source["deployedAt"];
	        this.deployStartedAt = source["deployStartedAt"];
	        this.repoURL = source["repoURL"];
	        this.path = source["path"];
	        this.targetRevision = source["targetRevision"];
	        this.initiatedBy = source["initiatedBy"];
	        this.automated = source["automated"];
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
	export class ArgoApplicationSetGeneratedApp {
	    application: string;
	    status: string;
	    step: string;
	    message: string;
	    lastTransitionTime: string;
	    targetRevisions: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationSetGeneratedApp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.application = source["application"];
	        this.status = source["status"];
	        this.step = source["step"];
	        this.message = source["message"];
	        this.lastTransitionTime = source["lastTransitionTime"];
	        this.targetRevisions = source["targetRevisions"];
	    }
	}
	export class ArgoApplicationSetGenerator {
	    type: string;
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationSetGenerator(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.summary = source["summary"];
	    }
	}
	export class ArgoApplicationSetDetail {
	    name: string;
	    namespace: string;
	    generators: ArgoApplicationSetGenerator[];
	    templateName: string;
	    templateProject: string;
	    templateRepoURL: string;
	    templatePath: string;
	    templateRevision: string;
	    templateDestNs: string;
	    generatedApps: ArgoApplicationSetGeneratedApp[];
	    conditions: ConditionDetail[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.generators = this.convertValues(source["generators"], ArgoApplicationSetGenerator);
	        this.templateName = source["templateName"];
	        this.templateProject = source["templateProject"];
	        this.templateRepoURL = source["templateRepoURL"];
	        this.templatePath = source["templatePath"];
	        this.templateRevision = source["templateRevision"];
	        this.templateDestNs = source["templateDestNs"];
	        this.generatedApps = this.convertValues(source["generatedApps"], ArgoApplicationSetGeneratedApp);
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
	
	
	export class ArgoApplicationSetInfo {
	    name: string;
	    namespace: string;
	    generatorTypes: string[];
	    appCount: number;
	    healthyCount: number;
	    syncedCount: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoApplicationSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.generatorTypes = source["generatorTypes"];
	        this.appCount = source["appCount"];
	        this.healthyCount = source["healthyCount"];
	        this.syncedCount = source["syncedCount"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ArgoSyncResultResource {
	    group: string;
	    version: string;
	    kind: string;
	    namespace: string;
	    name: string;
	    status: string;
	    message: string;
	    hookPhase: string;
	    hookType: string;
	    syncPhase: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoSyncResultResource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.version = source["version"];
	        this.kind = source["kind"];
	        this.namespace = source["namespace"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.message = source["message"];
	        this.hookPhase = source["hookPhase"];
	        this.hookType = source["hookType"];
	        this.syncPhase = source["syncPhase"];
	    }
	}
	export class ArgoOperationState {
	    phase: string;
	    message: string;
	    startedAt: string;
	    finishedAt: string;
	    revision: string;
	    dryRun: boolean;
	    resources: ArgoSyncResultResource[];
	
	    static createFrom(source: any = {}) {
	        return new ArgoOperationState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.phase = source["phase"];
	        this.message = source["message"];
	        this.startedAt = source["startedAt"];
	        this.finishedAt = source["finishedAt"];
	        this.revision = source["revision"];
	        this.dryRun = source["dryRun"];
	        this.resources = this.convertValues(source["resources"], ArgoSyncResultResource);
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
	export class ArgoSyncResourceSelector {
	    group: string;
	    kind: string;
	    name: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new ArgoSyncResourceSelector(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.group = source["group"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	    }
	}
	export class ArgoSyncOptions {
	    revision: string;
	    dryRun: boolean;
	    prune: boolean;
	    force: boolean;
	    replace: boolean;
	    serverSideApply: boolean;
	    strategy: string;
	    resources: ArgoSyncResourceSelector[];
	
	    static createFrom(source: any = {}) {
	        return new ArgoSyncOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.revision = source["revision"];
	        this.dryRun = source["dryRun"];
	        this.prune = source["prune"];
	        this.force = source["force"];
	        this.replace = source["replace"];
	        this.serverSideApply = source["serverSideApply"];
	        this.strategy = source["strategy"];
	        this.resources = this.convertValues(source["resources"], ArgoSyncResourceSelector);
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
	export class CertManagerCondition {
	    type: string;
	    status: string;
	    reason: string;
	    message: string;
	    lastTransitionTime: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.status = source["status"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.lastTransitionTime = source["lastTransitionTime"];
	    }
	}
	export class CertManagerCertificateDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    secretName: string;
	    issuer: string;
	    commonName: string;
	    notAfter: string;
	    renewalTime: string;
	    createdAt: string;
	    conditions: CertManagerCondition[];
	    issuerKind: string;
	    issuerGroup: string;
	    dnsNames: string[];
	    ipAddresses: string[];
	    uris: string[];
	    usages: string[];
	    notBefore: string;
	    duration: string;
	    renewBefore: string;
	    isCA: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerCertificateDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.secretName = source["secretName"];
	        this.issuer = source["issuer"];
	        this.commonName = source["commonName"];
	        this.notAfter = source["notAfter"];
	        this.renewalTime = source["renewalTime"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], CertManagerCondition);
	        this.issuerKind = source["issuerKind"];
	        this.issuerGroup = source["issuerGroup"];
	        this.dnsNames = source["dnsNames"];
	        this.ipAddresses = source["ipAddresses"];
	        this.uris = source["uris"];
	        this.usages = source["usages"];
	        this.notBefore = source["notBefore"];
	        this.duration = source["duration"];
	        this.renewBefore = source["renewBefore"];
	        this.isCA = source["isCA"];
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
	export class CertManagerCertificateInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    secretName: string;
	    issuer: string;
	    commonName: string;
	    notAfter: string;
	    renewalTime: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerCertificateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.secretName = source["secretName"];
	        this.issuer = source["issuer"];
	        this.commonName = source["commonName"];
	        this.notAfter = source["notAfter"];
	        this.renewalTime = source["renewalTime"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CertManagerCertificateRequestDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    approved: string;
	    denied: string;
	    status: string;
	    issuer: string;
	    createdAt: string;
	    conditions: CertManagerCondition[];
	    issuerKind: string;
	    issuerGroup: string;
	    usages: string[];
	    isCA: boolean;
	    failureTime: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerCertificateRequestDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.approved = source["approved"];
	        this.denied = source["denied"];
	        this.status = source["status"];
	        this.issuer = source["issuer"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], CertManagerCondition);
	        this.issuerKind = source["issuerKind"];
	        this.issuerGroup = source["issuerGroup"];
	        this.usages = source["usages"];
	        this.isCA = source["isCA"];
	        this.failureTime = source["failureTime"];
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
	export class CertManagerCertificateRequestInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    approved: string;
	    denied: string;
	    status: string;
	    issuer: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerCertificateRequestInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.approved = source["approved"];
	        this.denied = source["denied"];
	        this.status = source["status"];
	        this.issuer = source["issuer"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CertManagerChallengeDetail {
	    name: string;
	    namespace: string;
	    state: string;
	    type: string;
	    dnsName: string;
	    reason: string;
	    createdAt: string;
	    token: string;
	    wildcard: boolean;
	    presented: boolean;
	    processing: boolean;
	    authorizationURL: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerChallengeDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.state = source["state"];
	        this.type = source["type"];
	        this.dnsName = source["dnsName"];
	        this.reason = source["reason"];
	        this.createdAt = source["createdAt"];
	        this.token = source["token"];
	        this.wildcard = source["wildcard"];
	        this.presented = source["presented"];
	        this.processing = source["processing"];
	        this.authorizationURL = source["authorizationURL"];
	    }
	}
	export class CertManagerChallengeInfo {
	    name: string;
	    namespace: string;
	    state: string;
	    type: string;
	    dnsName: string;
	    reason: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerChallengeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.state = source["state"];
	        this.type = source["type"];
	        this.dnsName = source["dnsName"];
	        this.reason = source["reason"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class CertManagerIssuerDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    type: string;
	    createdAt: string;
	    conditions: CertManagerCondition[];
	    acmeServer: string;
	    acmeEmail: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerIssuerDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.type = source["type"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], CertManagerCondition);
	        this.acmeServer = source["acmeServer"];
	        this.acmeEmail = source["acmeEmail"];
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
	export class CertManagerIssuerInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    type: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerIssuerInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.type = source["type"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CertManagerOrderDetail {
	    name: string;
	    namespace: string;
	    state: string;
	    reason: string;
	    dnsNames: string;
	    createdAt: string;
	    commonName: string;
	    dnsNameList: string[];
	    url: string;
	    finalizeURL: string;
	    authorizations: number;
	    failureTime: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerOrderDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.state = source["state"];
	        this.reason = source["reason"];
	        this.dnsNames = source["dnsNames"];
	        this.createdAt = source["createdAt"];
	        this.commonName = source["commonName"];
	        this.dnsNameList = source["dnsNameList"];
	        this.url = source["url"];
	        this.finalizeURL = source["finalizeURL"];
	        this.authorizations = source["authorizations"];
	        this.failureTime = source["failureTime"];
	    }
	}
	export class CertManagerOrderInfo {
	    name: string;
	    namespace: string;
	    state: string;
	    reason: string;
	    dnsNames: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new CertManagerOrderInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.state = source["state"];
	        this.reason = source["reason"];
	        this.dnsNames = source["dnsNames"];
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
	export class ContainerResources {
	    cpuRequest: string;
	    cpuLimit: string;
	    memRequest: string;
	    memLimit: string;
	
	    static createFrom(source: any = {}) {
	        return new ContainerResources(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpuRequest = source["cpuRequest"];
	        this.cpuLimit = source["cpuLimit"];
	        this.memRequest = source["memRequest"];
	        this.memLimit = source["memLimit"];
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
	    resources: ContainerResources;
	    allocated: ContainerResources;
	
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
	        this.resources = this.convertValues(source["resources"], ContainerResources);
	        this.allocated = this.convertValues(source["allocated"], ContainerResources);
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
	export class DeviceSelectorDetail {
	    expression: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceSelectorDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.expression = source["expression"];
	    }
	}
	export class DeviceClassDetail {
	    name: string;
	    uid: string;
	    selectors: DeviceSelectorDetail[];
	    config: number;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceClassDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.selectors = this.convertValues(source["selectors"], DeviceSelectorDetail);
	        this.config = source["config"];
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
	export class DeviceClassInfo {
	    name: string;
	    selectors: number;
	    config: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DeviceClassInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.selectors = source["selectors"];
	        this.config = source["config"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class DeviceRequestDetail {
	    name: string;
	    deviceClassName: string;
	    allocationMode: string;
	    count: number;
	    selectors: string[];
	    adminAccess: boolean;
	    firstAvailable: number;
	
	    static createFrom(source: any = {}) {
	        return new DeviceRequestDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.deviceClassName = source["deviceClassName"];
	        this.allocationMode = source["allocationMode"];
	        this.count = source["count"];
	        this.selectors = source["selectors"];
	        this.adminAccess = source["adminAccess"];
	        this.firstAvailable = source["firstAvailable"];
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
	export class FlowSchemaRuleDetail {
	    subjects: string[];
	    resourceRules: string[];
	    nonResourceURLs: string[];
	
	    static createFrom(source: any = {}) {
	        return new FlowSchemaRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subjects = source["subjects"];
	        this.resourceRules = source["resourceRules"];
	        this.nonResourceURLs = source["nonResourceURLs"];
	    }
	}
	export class FlowSchemaDetail {
	    name: string;
	    uid: string;
	    priorityLevel: string;
	    matchingPrecedence: number;
	    distinguisher: string;
	    rules: FlowSchemaRuleDetail[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FlowSchemaDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.priorityLevel = source["priorityLevel"];
	        this.matchingPrecedence = source["matchingPrecedence"];
	        this.distinguisher = source["distinguisher"];
	        this.rules = this.convertValues(source["rules"], FlowSchemaRuleDetail);
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
	export class FlowSchemaInfo {
	    name: string;
	    priorityLevel: string;
	    matchingPrecedence: number;
	    distinguisher: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FlowSchemaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.priorityLevel = source["priorityLevel"];
	        this.matchingPrecedence = source["matchingPrecedence"];
	        this.distinguisher = source["distinguisher"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class FluxAlertSource {
	    kind: string;
	    name: string;
	    namespace: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxAlertSource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	    }
	}
	export class FluxCondition {
	    type: string;
	    status: string;
	    reason: string;
	    message: string;
	    lastTransitionTime: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.status = source["status"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.lastTransitionTime = source["lastTransitionTime"];
	    }
	}
	export class FluxAlertDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    provider: string;
	    severity: string;
	    summary: string;
	    sources: string;
	    sourceCount: number;
	    createdAt: string;
	    conditions: FluxCondition[];
	    eventSources: FluxAlertSource[];
	    inclusionList: string[];
	    exclusionList: string[];
	    eventMetadata: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new FluxAlertDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.provider = source["provider"];
	        this.severity = source["severity"];
	        this.summary = source["summary"];
	        this.sources = source["sources"];
	        this.sourceCount = source["sourceCount"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.eventSources = this.convertValues(source["eventSources"], FluxAlertSource);
	        this.inclusionList = source["inclusionList"];
	        this.exclusionList = source["exclusionList"];
	        this.eventMetadata = source["eventMetadata"];
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
	export class FluxAlertInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    provider: string;
	    severity: string;
	    summary: string;
	    sources: string;
	    sourceCount: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxAlertInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.provider = source["provider"];
	        this.severity = source["severity"];
	        this.summary = source["summary"];
	        this.sources = source["sources"];
	        this.sourceCount = source["sourceCount"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class FluxBucketDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    provider: string;
	    bucketName: string;
	    endpoint: string;
	    region: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    secretRef: string;
	    timeout: string;
	    insecure: boolean;
	    prefix: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxBucketDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.provider = source["provider"];
	        this.bucketName = source["bucketName"];
	        this.endpoint = source["endpoint"];
	        this.region = source["region"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.secretRef = source["secretRef"];
	        this.timeout = source["timeout"];
	        this.insecure = source["insecure"];
	        this.prefix = source["prefix"];
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
	export class FluxBucketInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    provider: string;
	    bucketName: string;
	    endpoint: string;
	    region: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxBucketInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.provider = source["provider"];
	        this.bucketName = source["bucketName"];
	        this.endpoint = source["endpoint"];
	        this.region = source["region"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class FluxGitRepositoryDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    url: string;
	    ref: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    secretRef: string;
	    timeout: string;
	    ignorePatterns: string;
	    verification: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxGitRepositoryDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.url = source["url"];
	        this.ref = source["ref"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.secretRef = source["secretRef"];
	        this.timeout = source["timeout"];
	        this.ignorePatterns = source["ignorePatterns"];
	        this.verification = source["verification"];
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
	export class FluxGitRepositoryInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    url: string;
	    ref: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxGitRepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.url = source["url"];
	        this.ref = source["ref"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxHelmReleaseDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    chart: string;
	    version: string;
	    sourceRef: string;
	    lastAppliedRevision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    releaseName: string;
	    targetNamespace: string;
	    storageNamespace: string;
	    serviceAccount: string;
	    timeout: string;
	    dependsOn: string[];
	
	    static createFrom(source: any = {}) {
	        return new FluxHelmReleaseDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.chart = source["chart"];
	        this.version = source["version"];
	        this.sourceRef = source["sourceRef"];
	        this.lastAppliedRevision = source["lastAppliedRevision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.releaseName = source["releaseName"];
	        this.targetNamespace = source["targetNamespace"];
	        this.storageNamespace = source["storageNamespace"];
	        this.serviceAccount = source["serviceAccount"];
	        this.timeout = source["timeout"];
	        this.dependsOn = source["dependsOn"];
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
	export class FluxHelmReleaseInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    chart: string;
	    version: string;
	    sourceRef: string;
	    lastAppliedRevision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxHelmReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.chart = source["chart"];
	        this.version = source["version"];
	        this.sourceRef = source["sourceRef"];
	        this.lastAppliedRevision = source["lastAppliedRevision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxHelmRepositoryDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    provider: string;
	    url: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    secretRef: string;
	    timeout: string;
	    passCredentials: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FluxHelmRepositoryDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.provider = source["provider"];
	        this.url = source["url"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.secretRef = source["secretRef"];
	        this.timeout = source["timeout"];
	        this.passCredentials = source["passCredentials"];
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
	export class FluxHelmRepositoryInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    provider: string;
	    url: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxHelmRepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.provider = source["provider"];
	        this.url = source["url"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxKustomizationDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    path: string;
	    sourceRef: string;
	    revision: string;
	    lastAppliedRevision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    prune: boolean;
	    force: boolean;
	    wait: boolean;
	    targetNamespace: string;
	    serviceAccountName: string;
	    timeout: string;
	    retryInterval: string;
	    dependsOn: string[];
	
	    static createFrom(source: any = {}) {
	        return new FluxKustomizationDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.path = source["path"];
	        this.sourceRef = source["sourceRef"];
	        this.revision = source["revision"];
	        this.lastAppliedRevision = source["lastAppliedRevision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.prune = source["prune"];
	        this.force = source["force"];
	        this.wait = source["wait"];
	        this.targetNamespace = source["targetNamespace"];
	        this.serviceAccountName = source["serviceAccountName"];
	        this.timeout = source["timeout"];
	        this.retryInterval = source["retryInterval"];
	        this.dependsOn = source["dependsOn"];
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
	export class FluxKustomizationInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    path: string;
	    sourceRef: string;
	    revision: string;
	    lastAppliedRevision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxKustomizationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.path = source["path"];
	        this.sourceRef = source["sourceRef"];
	        this.revision = source["revision"];
	        this.lastAppliedRevision = source["lastAppliedRevision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxOCIRepositoryDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    url: string;
	    ref: string;
	    provider: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    secretRef: string;
	    serviceAccountName: string;
	    certSecretRef: string;
	    timeout: string;
	    verify: string;
	    insecure: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FluxOCIRepositoryDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.url = source["url"];
	        this.ref = source["ref"];
	        this.provider = source["provider"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.secretRef = source["secretRef"];
	        this.serviceAccountName = source["serviceAccountName"];
	        this.certSecretRef = source["certSecretRef"];
	        this.timeout = source["timeout"];
	        this.verify = source["verify"];
	        this.insecure = source["insecure"];
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
	export class FluxOCIRepositoryInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    url: string;
	    ref: string;
	    provider: string;
	    revision: string;
	    interval: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxOCIRepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.url = source["url"];
	        this.ref = source["ref"];
	        this.provider = source["provider"];
	        this.revision = source["revision"];
	        this.interval = source["interval"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxProviderDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    channel: string;
	    username: string;
	    address: string;
	    addressFromSecret: boolean;
	    createdAt: string;
	    conditions: FluxCondition[];
	    secretRef: string;
	    certSecretRef: string;
	    proxy: string;
	    timeout: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxProviderDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.channel = source["channel"];
	        this.username = source["username"];
	        this.address = source["address"];
	        this.addressFromSecret = source["addressFromSecret"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.secretRef = source["secretRef"];
	        this.certSecretRef = source["certSecretRef"];
	        this.proxy = source["proxy"];
	        this.timeout = source["timeout"];
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
	export class FluxProviderInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    channel: string;
	    username: string;
	    address: string;
	    addressFromSecret: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxProviderInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.channel = source["channel"];
	        this.username = source["username"];
	        this.address = source["address"];
	        this.addressFromSecret = source["addressFromSecret"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class FluxReceiverDetail {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    webhookPath: string;
	    resourceCount: number;
	    secretRef: string;
	    createdAt: string;
	    conditions: FluxCondition[];
	    events: string[];
	    resources: FluxAlertSource[];
	    interval: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxReceiverDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.webhookPath = source["webhookPath"];
	        this.resourceCount = source["resourceCount"];
	        this.secretRef = source["secretRef"];
	        this.createdAt = source["createdAt"];
	        this.conditions = this.convertValues(source["conditions"], FluxCondition);
	        this.events = source["events"];
	        this.resources = this.convertValues(source["resources"], FluxAlertSource);
	        this.interval = source["interval"];
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
	export class FluxReceiverInfo {
	    name: string;
	    namespace: string;
	    ready: string;
	    status: string;
	    suspended: boolean;
	    type: string;
	    webhookPath: string;
	    resourceCount: number;
	    secretRef: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new FluxReceiverInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.ready = source["ready"];
	        this.status = source["status"];
	        this.suspended = source["suspended"];
	        this.type = source["type"];
	        this.webhookPath = source["webhookPath"];
	        this.resourceCount = source["resourceCount"];
	        this.secretRef = source["secretRef"];
	        this.createdAt = source["createdAt"];
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
	    reading: string;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new HPAMetricTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	        this.target = source["target"];
	        this.text = source["text"];
	        this.reading = source["reading"];
	        this.source = source["source"];
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
	export class IPAddressDetail {
	    name: string;
	    uid: string;
	    parentRef: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IPAddressDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.parentRef = source["parentRef"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class IPAddressInfo {
	    name: string;
	    parentRef: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IPAddressInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.parentRef = source["parentRef"];
	        this.createdAt = source["createdAt"];
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
	
	
	
	export class IstioSubset {
	    name: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new IstioSubset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.labels = source["labels"];
	    }
	}
	export class IstioDestinationRuleDetail {
	    name: string;
	    namespace: string;
	    host: string;
	    subsets: string[];
	    tlsMode: string;
	    createdAt: string;
	    subsetDetails: IstioSubset[];
	    loadBalancer: string;
	
	    static createFrom(source: any = {}) {
	        return new IstioDestinationRuleDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.host = source["host"];
	        this.subsets = source["subsets"];
	        this.tlsMode = source["tlsMode"];
	        this.createdAt = source["createdAt"];
	        this.subsetDetails = this.convertValues(source["subsetDetails"], IstioSubset);
	        this.loadBalancer = source["loadBalancer"];
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
	export class IstioDestinationRuleInfo {
	    name: string;
	    namespace: string;
	    host: string;
	    subsets: string[];
	    tlsMode: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IstioDestinationRuleInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.host = source["host"];
	        this.subsets = source["subsets"];
	        this.tlsMode = source["tlsMode"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class IstioDestinationWeight {
	    host: string;
	    subset: string;
	    port: number;
	    weight: number;
	
	    static createFrom(source: any = {}) {
	        return new IstioDestinationWeight(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.subset = source["subset"];
	        this.port = source["port"];
	        this.weight = source["weight"];
	    }
	}
	export class IstioPortMTLS {
	    port: number;
	    mode: string;
	
	    static createFrom(source: any = {}) {
	        return new IstioPortMTLS(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.mode = source["mode"];
	    }
	}
	export class IstioPeerAuthenticationDetail {
	    name: string;
	    namespace: string;
	    mtlsMode: string;
	    selector: string;
	    createdAt: string;
	    selectorLabels: Record<string, string>;
	    portLevel: IstioPortMTLS[];
	
	    static createFrom(source: any = {}) {
	        return new IstioPeerAuthenticationDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.mtlsMode = source["mtlsMode"];
	        this.selector = source["selector"];
	        this.createdAt = source["createdAt"];
	        this.selectorLabels = source["selectorLabels"];
	        this.portLevel = this.convertValues(source["portLevel"], IstioPortMTLS);
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
	export class IstioPeerAuthenticationInfo {
	    name: string;
	    namespace: string;
	    mtlsMode: string;
	    selector: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IstioPeerAuthenticationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.mtlsMode = source["mtlsMode"];
	        this.selector = source["selector"];
	        this.createdAt = source["createdAt"];
	    }
	}
	
	export class IstioRouteRule {
	    match: string;
	    destinations: IstioDestinationWeight[];
	
	    static createFrom(source: any = {}) {
	        return new IstioRouteRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.match = source["match"];
	        this.destinations = this.convertValues(source["destinations"], IstioDestinationWeight);
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
	
	export class IstioVirtualServiceDetail {
	    name: string;
	    namespace: string;
	    hosts: string[];
	    gateways: string[];
	    httpCount: number;
	    tlsCount: number;
	    tcpCount: number;
	    createdAt: string;
	    httpRoutes: IstioRouteRule[];
	    tlsRoutes: IstioRouteRule[];
	    tcpRoutes: IstioRouteRule[];
	
	    static createFrom(source: any = {}) {
	        return new IstioVirtualServiceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.hosts = source["hosts"];
	        this.gateways = source["gateways"];
	        this.httpCount = source["httpCount"];
	        this.tlsCount = source["tlsCount"];
	        this.tcpCount = source["tcpCount"];
	        this.createdAt = source["createdAt"];
	        this.httpRoutes = this.convertValues(source["httpRoutes"], IstioRouteRule);
	        this.tlsRoutes = this.convertValues(source["tlsRoutes"], IstioRouteRule);
	        this.tcpRoutes = this.convertValues(source["tcpRoutes"], IstioRouteRule);
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
	export class IstioVirtualServiceInfo {
	    name: string;
	    namespace: string;
	    hosts: string[];
	    gateways: string[];
	    httpCount: number;
	    tlsCount: number;
	    tcpCount: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IstioVirtualServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.hosts = source["hosts"];
	        this.gateways = source["gateways"];
	        this.httpCount = source["httpCount"];
	        this.tlsCount = source["tlsCount"];
	        this.tcpCount = source["tcpCount"];
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
	export class KarpenterNodeClaimInfo {
	    name: string;
	    nodeName: string;
	    nodePool: string;
	    nodeClassKind: string;
	    nodeClassName: string;
	    instanceType: string;
	    capacityType: string;
	    zone: string;
	    providerID: string;
	    cpu: string;
	    memory: string;
	    launched: string;
	    registered: string;
	    initialized: string;
	    drifted: string;
	    ready: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new KarpenterNodeClaimInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.nodeName = source["nodeName"];
	        this.nodePool = source["nodePool"];
	        this.nodeClassKind = source["nodeClassKind"];
	        this.nodeClassName = source["nodeClassName"];
	        this.instanceType = source["instanceType"];
	        this.capacityType = source["capacityType"];
	        this.zone = source["zone"];
	        this.providerID = source["providerID"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	        this.launched = source["launched"];
	        this.registered = source["registered"];
	        this.initialized = source["initialized"];
	        this.drifted = source["drifted"];
	        this.ready = source["ready"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class KarpenterNodePoolInfo {
	    name: string;
	    weight: number;
	    nodeClassKind: string;
	    nodeClassName: string;
	    consolidationPolicy: string;
	    consolidateAfter: string;
	    cpuLimit: string;
	    memoryLimit: string;
	    cpuUsage: string;
	    memoryUsage: string;
	    nodeCount: string;
	    ready: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new KarpenterNodePoolInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.weight = source["weight"];
	        this.nodeClassKind = source["nodeClassKind"];
	        this.nodeClassName = source["nodeClassName"];
	        this.consolidationPolicy = source["consolidationPolicy"];
	        this.consolidateAfter = source["consolidateAfter"];
	        this.cpuLimit = source["cpuLimit"];
	        this.memoryLimit = source["memoryLimit"];
	        this.cpuUsage = source["cpuUsage"];
	        this.memoryUsage = source["memoryUsage"];
	        this.nodeCount = source["nodeCount"];
	        this.ready = source["ready"];
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
	
	
	export class MutationDiff {
	    kind: string;
	    name: string;
	    action: string;
	    before: string;
	    after: string;
	
	    static createFrom(source: any = {}) {
	        return new MutationDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.action = source["action"];
	        this.before = source["before"];
	        this.after = source["after"];
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
	    instanceType: string;
	    capacityType: string;
	    nodePool: string;
	    cpuAllocMC: number;
	    memAllocB: number;
	    memoryPressure: boolean;
	    diskPressure: boolean;
	    pidPressure: boolean;
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
	        this.instanceType = source["instanceType"];
	        this.capacityType = source["capacityType"];
	        this.nodePool = source["nodePool"];
	        this.cpuAllocMC = source["cpuAllocMC"];
	        this.memAllocB = source["memAllocB"];
	        this.memoryPressure = source["memoryPressure"];
	        this.diskPressure = source["diskPressure"];
	        this.pidPressure = source["pidPressure"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class NodeMetrics {
	    name: string;
	    cpuMC: number;
	    memB: number;
	
	    static createFrom(source: any = {}) {
	        return new NodeMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cpuMC = source["cpuMC"];
	        this.memB = source["memB"];
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
	export class PodContainerBrief {
	    name: string;
	    init: boolean;
	    tone: string;
	    state: string;
	
	    static createFrom(source: any = {}) {
	        return new PodContainerBrief(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.init = source["init"];
	        this.tone = source["tone"];
	        this.state = source["state"];
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
	    resizeStatus: string;
	
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
	        this.resizeStatus = source["resizeStatus"];
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
	    containers: PodContainerBrief[];
	
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
	        this.containers = this.convertValues(source["containers"], PodContainerBrief);
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
	export class PriorityLevelConfigurationDetail {
	    name: string;
	    uid: string;
	    type: string;
	    nominalConcurrencyShares: number;
	    lendablePercent: number;
	    limitResponse: string;
	    queues: number;
	    handSize: number;
	    queueLengthLimit: number;
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PriorityLevelConfigurationDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.type = source["type"];
	        this.nominalConcurrencyShares = source["nominalConcurrencyShares"];
	        this.lendablePercent = source["lendablePercent"];
	        this.limitResponse = source["limitResponse"];
	        this.queues = source["queues"];
	        this.handSize = source["handSize"];
	        this.queueLengthLimit = source["queueLengthLimit"];
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
	export class PriorityLevelConfigurationInfo {
	    name: string;
	    type: string;
	    nominalConcurrencyShares: number;
	    limitResponse: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new PriorityLevelConfigurationInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.nominalConcurrencyShares = source["nominalConcurrencyShares"];
	        this.limitResponse = source["limitResponse"];
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
	export class ResourceClaimDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    status: string;
	    requests: DeviceRequestDetail[];
	    allocatedDevices: AllocatedDeviceDetail[];
	    reservedFor: string[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceClaimDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.status = source["status"];
	        this.requests = this.convertValues(source["requests"], DeviceRequestDetail);
	        this.allocatedDevices = this.convertValues(source["allocatedDevices"], AllocatedDeviceDetail);
	        this.reservedFor = source["reservedFor"];
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
	export class ResourceClaimInfo {
	    name: string;
	    namespace: string;
	    requests: number;
	    status: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceClaimInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.requests = source["requests"];
	        this.status = source["status"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ResourceClaimTemplateDetail {
	    name: string;
	    namespace: string;
	    uid: string;
	    requests: DeviceRequestDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceClaimTemplateDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.uid = source["uid"];
	        this.requests = this.convertValues(source["requests"], DeviceRequestDetail);
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
	export class ResourceClaimTemplateInfo {
	    name: string;
	    namespace: string;
	    requests: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceClaimTemplateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.requests = source["requests"];
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
	export class ResourceSliceDeviceDetail {
	    name: string;
	    attributes: string[];
	    capacities: string[];
	    bindsToNode: boolean;
	    taints: number;
	
	    static createFrom(source: any = {}) {
	        return new ResourceSliceDeviceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.attributes = source["attributes"];
	        this.capacities = source["capacities"];
	        this.bindsToNode = source["bindsToNode"];
	        this.taints = source["taints"];
	    }
	}
	export class ResourceSliceDetail {
	    name: string;
	    uid: string;
	    driver: string;
	    poolName: string;
	    nodeName: string;
	    allNodes: boolean;
	    devices: ResourceSliceDeviceDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceSliceDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.driver = source["driver"];
	        this.poolName = source["poolName"];
	        this.nodeName = source["nodeName"];
	        this.allNodes = source["allNodes"];
	        this.devices = this.convertValues(source["devices"], ResourceSliceDeviceDetail);
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
	
	export class ResourceSliceInfo {
	    name: string;
	    driver: string;
	    pool: string;
	    nodeName: string;
	    devices: number;
	    allNodes: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourceSliceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.driver = source["driver"];
	        this.pool = source["pool"];
	        this.nodeName = source["nodeName"];
	        this.devices = source["devices"];
	        this.allNodes = source["allNodes"];
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
	export class ServiceCIDRDetail {
	    name: string;
	    uid: string;
	    cidrs: string[];
	    conditions: ConditionDetail[];
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceCIDRDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.uid = source["uid"];
	        this.cidrs = source["cidrs"];
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
	export class ServiceCIDRInfo {
	    name: string;
	    cidrs: string;
	    ready: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceCIDRInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cidrs = source["cidrs"];
	        this.ready = source["ready"];
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
	
	
	export class SystemTerminal {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemTerminal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
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

export namespace update {
	
	export class Result {
	    available: boolean;
	    current: string;
	    latest: string;
	    releaseURL: string;
	    notes: string;
	    publishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.current = source["current"];
	        this.latest = source["latest"];
	        this.releaseURL = source["releaseURL"];
	        this.notes = source["notes"];
	        this.publishedAt = source["publishedAt"];
	    }
	}

}

