<cfset request.pageTitle = "CFML pages">
<cfset request.lookAt = [
	"Same bar and console data as the .bxm pages: queries, timeline, HTTP calls, locks and errors.",
	"The Queries tab shows the line in the .cfm or .cfc that ran each statement.",
	"Needs the bx-compat-cfml module, which the start scripts install."
]>
<cfinclude template="/includes/header.bxm">
<cfoutput>
<h1>CFML pages and components</h1>
<p>BoxLang runs <code>.cfm</code> templates and <code>.cfc</code> components, and BxLens watches them the same way.</p>
<ul>
	<li><a href="/legacy/orders.cfm">orders.cfm</a>: a healthy tag based page with <code>cfquery</code> and <code>cfqueryparam</code>.</li>
	<li><a href="/legacy/n-plus-one.cfm">n-plus-one.cfm</a>: the N+1 mistake inside a <code>.cfc</code>.</li>
	<li><a href="/legacy/tags.cfm">tags.cfm</a>: <code>cfhttp</code>, <code>cflock</code>, <code>cfthread</code>, <code>cftry</code> and <code>cfcache</code> in one page.</li>
	<li><a href="/legacy/error.cfm">error.cfm</a>: an uncaught <code>cfthrow</code>.</li>
</ul>
</cfoutput>
<cfinclude template="/includes/footer.bxm">
