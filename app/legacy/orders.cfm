<cfset request.pageTitle = "CFML orders">
<cfset request.lookAt = [ "Bar > Queries: one statement, with the bound customer id parameter when includeParams is on.", "Bar > Timeline: the template and the query." ]>
<cfquery name="orders" datasource="demo">
	SELECT o.id, o.total, o.status, c.name
	FROM orders o JOIN customers c ON c.id = o.customer_id
	WHERE o.status = <cfqueryparam value="open" cfsqltype="cf_sql_varchar">
	ORDER BY o.id DESC FETCH FIRST 8 ROWS ONLY
</cfquery>
<cfinclude template="/includes/header.bxm">
<cfoutput>
<h1>CFML orders</h1>
<table>
	<tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr>
	<cfloop query="orders">
		<tr><td>#orders.id#</td><td>#encodeForHTML( orders.name )#</td><td>#numberFormat( orders.total, "9,999.99" )#</td><td>#orders.status#</td></tr>
	</cfloop>
</table>
</cfoutput>
<cfinclude template="/includes/footer.bxm">
