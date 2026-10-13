<cfset request.pageTitle = "CFML N+1">
<cfset request.lookAt = [ "Bar > Queries and Console > Requests > Issues: the repeated customer statement, with the .cfc line that ran it." ]>
<cfset svc = new demo.legacy.OrderService()>
<cfset rows = svc.withCustomers()>
<cfinclude template="/includes/header.bxm">
<cfoutput>
<h1>CFML N+1</h1>
<p>#arrayLen( rows )# orders, #arrayLen( rows ) + 1# queries.</p>
<table>
	<tr><th>Order</th><th>Customer</th></tr>
	<cfloop array="#rows#" item="r"><tr><td>#r.order#</td><td>#encodeForHTML( r.customer )#</td></tr></cfloop>
</table>
</cfoutput>
<cfinclude template="/includes/footer.bxm">
