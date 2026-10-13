<cfcomponent output="false" hint="A CFML component, to show BxLens works on .cfc code too">

	<cfset variables.dsn = "demo">

	<cffunction name="list" access="public" returntype="query">
		<cfargument name="max" type="numeric" default="10">
		<cfset var q = "">
		<cfquery name="q" datasource="#variables.dsn#">
			SELECT id, customer_id, total, status FROM orders ORDER BY id FETCH FIRST #int( arguments.max )# ROWS ONLY
		</cfquery>
		<cfreturn q>
	</cffunction>

	<cffunction name="customerName" access="public" returntype="string">
		<cfargument name="id" type="numeric" required="true">
		<cfset var q = "">
		<cfquery name="q" datasource="#variables.dsn#">
			SELECT name FROM customers WHERE id = <cfqueryparam value="#arguments.id#" cfsqltype="cf_sql_integer">
		</cfquery>
		<cfreturn q.name>
	</cffunction>

	<cffunction name="withCustomers" access="public" returntype="array" hint="The N+1 mistake, in CFML">
		<cfset var rows = []>
		<cfloop query="#list( 10 )#">
			<cfset arrayAppend( rows, { order : id, customer : customerName( customer_id ) } )>
		</cfloop>
		<cfreturn rows>
	</cffunction>

</cfcomponent>
