<cfset request.pageTitle = "CFML tags">
<cfset request.lookAt = [
	"Bar > HTTP: the cfhttp call to the rates endpoint.",
	"Bar > Timeline: cflock wait, the thread, and the cached block.",
	"Bar > Exceptions: the cftry/cfcatch error."
]>
<cfset caughtMsg = "">
<cfhttp url="http://localhost:#cgi.server_port#/api/rates.json.bxm" result="rates" />
<cflock name="demo-legacy" type="exclusive" timeout="5">
	<cfset sleep( 40 )>
</cflock>
<cfthread name="legacyWorker#createUUID().left( 4 )#" action="run">
	<cfset sleep( 300 )>
</cfthread>
<cftry>
	<cfthrow type="LegacyError" message="Thrown with cfthrow and caught with cfcatch">
	<cfcatch type="any">
		<cfset caughtMsg = cfcatch.message>
		<cfset lensException( cfcatch )>
	</cfcatch>
</cftry>
<cfinclude template="/includes/header.bxm">
<cfoutput>
<h1>CFML tags</h1>
<p>cfhttp answered #rates.statusCode#. A thread was started. Caught: #encodeForHTML( caughtMsg )#</p>
</cfoutput>
<cfinclude template="/includes/footer.bxm">
